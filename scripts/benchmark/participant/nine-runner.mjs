import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { exchange } from './no-tools.mjs';
import { boundedSettings } from '../semantic/bounded-settings.mjs';
import { inspectNineRevision, sha256 } from './nine-plan.mjs';

const bytes = (value) => Buffer.from(JSON.stringify(value, null, 2) + '\n');
const save = (root, name, value) => writeFile(path.join(root, name), bytes(value), { flag: 'wx' });
async function boundedWait(promise, ms) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Coordinator operation deadline exceeded')), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
function immutable(value) {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value)) immutable(child);
  }
  return value;
}
export function standaloneHtml(text) {
  assert.equal(typeof text, 'string');
  let html = text.trim();
  if (html.startsWith('```')) {
    const match = /^```(?:html)?\r?\n([\s\S]*?)\r?\n```$/i.exec(html);
    assert.ok(match, 'Exactly one optional HTML fence required');
    html = match[1].trim();
  }
  assert.ok(/^<!doctype html>\s*<html(?:\s|>)/i.test(html), 'Complete standalone HTML required');
  assert.ok(/<\/html>\s*$/i.test(html), 'HTML closing root required');
  assert.equal((html.match(/<!doctype html>/gi) || []).length, 1, 'One document required');
  assert.ok(Buffer.byteLength(html) <= 1_000_000, 'HTML exceeds bound');
  return html;
}
export function usageReference(usage) {
  const input = usage?.input_tokens;
  const output = usage?.output_tokens;
  const cached = usage?.input_tokens_details?.cached_tokens ?? 0;
  const known =
    [input, output, cached].every((n) => Number.isSafeInteger(n) && n >= 0) && cached <= input;
  return {
    usage: usage ?? null,
    usageBasis: usage ? 'provider-reported-unverified' : 'unavailable',
    referenceUSD: known ? ((input - cached) * 2 + cached * 0.1 + output * 10) / 1_000_000 : null,
    referenceBasis:
      'Prior captured $2/M input, $0.10/M cached, $10/M output; conditional reference only, not invoice or enforceable cap',
    actualUSD: null,
    actualBasis: 'No settled route-specific billing evidence',
  };
}
function observedSettings(response) {
  return {
    model: response?.model ?? null,
    max_output_tokens: response?.max_output_tokens ?? null,
    temperature: response?.temperature ?? null,
    top_p: response?.top_p ?? null,
    reasoning: response?.reasoning ?? null,
    service_tier: response?.service_tier ?? null,
    tools: response?.tools ?? null,
    tool_choice: response?.tool_choice ?? null,
    store: response?.store ?? null,
  };
}
function settingDifference(first, next, manifest) {
  if (next.model != null && next.model !== manifest.model.requestedAlias)
    return 'returned-model-mismatch';
  for (const [key, expected] of Object.entries({ tools: [], tool_choice: 'none', store: false }))
    if (next[key] != null && JSON.stringify(next[key]) !== JSON.stringify(expected))
      return `returned-setting-mismatch:${key}`;
  if (next.max_output_tokens != null && next.max_output_tokens !== manifest.wire.max_output_tokens)
    return 'returned-setting-mismatch:max_output_tokens';
  if (first)
    for (const key of Object.keys(next))
      if (
        first[key] != null &&
        next[key] != null &&
        JSON.stringify(first[key]) !== JSON.stringify(next[key])
      )
        return 'reported-identity-or-setting-change';
  return null;
}
export function validateNineAuthorization({ authorization, manifestSha256, manifest, mode }) {
  assert.deepEqual(
    Object.keys(authorization ?? {}).sort(),
    [
      'approved',
      'manifestSha256',
      'mode',
      'maxDispatches',
      'retries',
      ...(mode === 'live-participant'
        ? ['routeFingerprint', 'moneyRisk', 'allowUnknownUsage', 'userDecisionReference']
        : []),
    ].sort(),
    'Authorization fields must exclude credentials and unreviewed controls'
  );
  assert.ok(
    ['offline-synthetic', 'live-participant'].includes(mode),
    'Explicit input origin required'
  );
  assert.equal(authorization?.approved, true, 'Admission not approved');
  assert.equal(authorization.manifestSha256, manifestSha256, 'Authorization plan mismatch');
  assert.equal(authorization.mode, mode, 'Authorization origin mismatch');
  assert.equal(authorization.maxDispatches, 9);
  assert.equal(authorization.retries, 0);
  if (mode === 'live-participant') {
    assert.equal(
      authorization.routeFingerprint,
      manifest.executionConfig.routeFingerprint,
      'Route grant mismatch'
    );
    assert.deepEqual(
      Object.keys(authorization.moneyRisk ?? {}).sort(),
      [
        'explicitUserApproval',
        'unknownActualBillingAccepted',
        'referenceEnvelopeIsNotHardCap',
        'noNewCreditPurchase',
        ...(manifest.budgetPolicy?.referenceEnvelopeStopEnabled === false
          ? ['costLimitsRemovedByUser']
          : []),
      ].sort()
    );
    assert.equal(
      authorization.moneyRisk?.explicitUserApproval,
      true,
      'Specific user fee authorization required'
    );
    assert.equal(
      authorization.moneyRisk?.unknownActualBillingAccepted,
      true,
      'No route monetary cap established: needs explicit alternative risk acceptance'
    );
    assert.equal(authorization.moneyRisk?.referenceEnvelopeIsNotHardCap, true);
    assert.equal(authorization.moneyRisk?.noNewCreditPurchase, true);
    if (manifest.budgetPolicy?.referenceEnvelopeStopEnabled === false) {
      assert.equal(authorization.moneyRisk.costLimitsRemovedByUser, true);
      assert.equal(
        authorization.userDecisionReference,
        manifest.budgetPolicy.userDecisionReference
      );
    }
    assert.equal(
      authorization.allowUnknownUsage,
      false,
      'Existing missing-usage stop policy required'
    );
    assert.ok(
      typeof authorization.userDecisionReference === 'string' &&
        authorization.userDecisionReference.length > 0
    );
  }
}
async function auditHttp(directory, requestBytes, requireAssembly) {
  const metadata = JSON.parse(await readFile(path.join(directory, 'transport.json'), 'utf8'));
  assert.ok(Array.isArray(metadata.files));
  for (const item of metadata.files) {
    assert.ok(/^[a-z.]+$/.test(item.name), 'Unsafe archived name');
    const value = await readFile(path.join(directory, item.name));
    assert.equal(value.length, item.bytes);
    assert.equal(sha256(value), item.sha256, 'Transport archive digest mismatch');
  }
  assert.ok(
    (await readFile(path.join(directory, 'request.json'))).equals(requestBytes),
    'Archived request differs from freeze'
  );
  assert.ok(
    metadata.files.some((f) => f.name === 'response.raw'),
    'Raw response absent'
  );
  if (requireAssembly) {
    for (const name of [
      'response.terminal.json',
      'response.assembled.json',
      'response.assembly.json',
    ])
      assert.ok(
        metadata.files.some((f) => f.name === name),
        `Missing ${name}`
      );
    assert.equal(metadata.outcome, 'response-received');
    assert.equal(metadata.rawBodyComplete, true);
  }
  return metadata;
}
async function defaultAssessment({ htmlPath, evidenceDir, chromiumPath, wallMs }) {
  const worker = await boundedSettings({ htmlPath, evidenceDir, chromiumPath, wallMs });
  let result = null;
  try {
    result = JSON.parse(await readFile(path.join(evidenceDir, 'result.json'), 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return { worker, result };
}
function summarizedChecks(manifest, assessment) {
  const raw = assessment?.result?.checks ?? [];
  const eligible = assessment?.worker?.eligibility?.scoringEligible === true;
  const checks = manifest.coreInventory.map(({ id }) => ({
    id,
    status: raw.find((c) => c.id === id)?.status ?? 'untested',
  }));
  if (eligible) {
    assert.equal(raw.length, 15);
    assert.ok(checks.every((c) => ['pass', 'fail'].includes(c.status)));
  }
  const count = (ids) =>
    eligible ? checks.filter((c) => ids.includes(c.id) && c.status === 'pass').length : null;
  return {
    scoringEligible: eligible,
    newFeaturePassed: count(manifest.newFeatureCriteria),
    newFeatureTotal: 6,
    regressionPassed: count(manifest.regressionCriteria),
    regressionTotal: 9,
    corePassed: count(checks.map((c) => c.id)),
    coreTotal: 15,
    allPassed: eligible && checks.every((c) => c.status === 'pass'),
    checks,
  };
}
function markdown(ledger) {
  const rows = ledger.rows.map(
    (r) =>
      `| ${r.id} | ${r.condition} | ${r.receivingStatus} | ${r.scoringEligible} | ${r.newFeaturePassed ?? '—'}/6 | ${r.regressionPassed ?? '—'}/9 | ${r.corePassed ?? '—'}/15 | ${r.allPassed} | ${r.participantMs ?? '—'} | ${r.usage?.input_tokens ?? '—'}/${r.usage?.output_tokens ?? '—'} | ${r.referenceUSD ?? '—'} | ${r.stopReason ?? r.error ?? ''} |`
  );
  const vectors = ledger.rows.map(
    (r) => `- ${r.id}: ${r.checks.map((c) => `${c.id}=${c.status}`).join('; ')}`
  );
  return `# Nine-slot ${ledger.mode} results\n\nOrigin: ${ledger.origin}. These are ${ledger.mode === 'offline-synthetic' ? 'OFFLINE SYNTHETIC controls, NOT participant/model results' : 'individual exploratory participant attempts'}.\n\nDispatches: ${ledger.dispatches}/9; stop: ${ledger.stopReason ?? 'none'}. Planned and unexecuted rows remain. Reference fees are NOT actual invoices or hard caps. No causal/significance/conformance conclusion.\n\n| Slot | Condition | Receiving | Scorable | New | Regression | All | All pass | Participant ms | Usage in/out | Reference USD | Failure/stop |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n${rows.join('\n')}\n\n## Full 15-criterion vectors\n\n${vectors.join('\n')}\n`;
}
/** Minimal serial executor. Factory/route observer are trusted coordinator seams,
 * never participant tools. Live approval is separate from a content freeze.
 * No retries, replacements, resume, discovery or score-dependent extra calls.
 */
export async function executeNine({
  directory,
  manifestSha256,
  sourceRoot,
  executionDirectory,
  mode,
  authorization,
  transportFactory,
  assess = defaultAssessment,
  observeRoute,
  now = Date.now,
}) {
  const { manifest, packets } = await inspectNineRevision({
    directory,
    manifestSha256,
    sourceRoot,
  });
  validateNineAuthorization({ authorization, manifestSha256, manifest, mode });
  assert.equal(typeof transportFactory, 'function');
  if (mode === 'live-participant')
    assert.equal(typeof observeRoute, 'function', 'Per-attempt route observation required');
  assert.ok(path.isAbsolute(executionDirectory));
  const start = now();
  const origin =
    mode === 'offline-synthetic'
      ? 'explicit-local-synthetic-controls'
      : 'new-participant-provider-attempts';
  const ledger = {
    schemaVersion: 1,
    kind: 'minimal-frozen-nine-run-ledger',
    mode,
    origin,
    synthetic: mode === 'offline-synthetic',
    manifestSha256,
    started: new Date(start).toISOString(),
    finished: null,
    dispatches: 0,
    participantProviderCalls: 0,
    retries: 0,
    stopReason: null,
    referenceKnownUSD: 0,
    actualUSD: null,
    rows: manifest.schedule.map((slot) => ({
      ...slot,
      origin,
      attempted: false,
      dispatched: false,
      receivingStatus: 'not-run',
      ...summarizedChecks(manifest, null),
      participantMs: null,
      workerMs: null,
      totalMs: null,
      usage: null,
      referenceUSD: null,
      actualUSD: null,
      error: null,
      stopReason: null,
    })),
  };
  await mkdir(executionDirectory);
  await save(executionDirectory, 'authorization.json', authorization);
  let firstSettings = null;
  const checkpoint = async () => {
    await writeFile(path.join(executionDirectory, 'ledger.next.json'), bytes(ledger), {
      flag: 'wx',
    });
    await rename(
      path.join(executionDirectory, 'ledger.next.json'),
      path.join(executionDirectory, 'ledger.json')
    );
  };
  await checkpoint();
  for (const row of ledger.rows) {
    if (ledger.stopReason) break;
    if (now() - start >= manifest.budgets.serialDispatchWindowMs) {
      ledger.stopReason = 'serial-dispatch-window-exhausted';
      break;
    }
    if (
      manifest.budgetPolicy?.referenceEnvelopeStopEnabled !== false &&
      ledger.referenceKnownUSD >= manifest.budgets.referenceFeeUSD
    ) {
      ledger.stopReason = 'reference-envelope-exhausted-not-monetary-cap';
      break;
    }
    const slotDir = path.join(executionDirectory, row.id);
    let attemptStart = null;
    try {
      // Recheck sources/packets before each dispatch, not merely once at startup.
      await inspectNineRevision({ directory, manifestSha256, sourceRoot });
      if (mode === 'live-participant') {
        const observed = await observeRoute();
        assert.equal(
          observed.routeFingerprint,
          manifest.executionConfig.routeFingerprint,
          'route-configuration-change'
        );
      }
      row.attempted = true;
      attemptStart = now();
      await mkdir(slotDir);
      await save(slotDir, 'reservation.json', {
        ...row,
        reservedAt: new Date(attemptStart).toISOString(),
        retry: false,
      });
      await checkpoint();
      const entry = packets[row.condition];
      const transport = await boundedWait(
        Promise.resolve().then(() =>
          transportFactory({
            slot: immutable({ ...row }),
            archiveDir: path.join(slotDir, 'http'),
            executionConfig: immutable(structuredClone(manifest.executionConfig)),
          })
        ),
        manifest.budgets.participantWallMs
      );
      assert.equal(typeof transport, 'function');
      let inFlight;
      let called = false;
      const wrapped = async (body, signal) => {
        assert.equal(called, false, 'Duplicate transport call forbidden');
        assert.ok(
          Buffer.from(JSON.stringify(body)).equals(entry.requestBytes),
          'Packet contamination or serialization drift'
        );
        called = true;
        row.dispatched = true;
        ledger.dispatches++;
        if (mode === 'live-participant') ledger.participantProviderCalls++;
        await save(slotDir, 'dispatch-attempt.json', {
          slot: row.id,
          mode,
          origin,
          requestSha256: row.requestSha256,
          at: new Date(now()).toISOString(),
          dispatchUncertaintyCountsAgainstLimit: true,
        });
        await checkpoint();
        inFlight = Promise.resolve().then(() => transport(body, signal));
        return inFlight;
      };
      const exchangeResult = await exchange({
        packet: entry.packet,
        model: manifest.model.requestedAlias,
        maxOutputTokens: manifest.wire.max_output_tokens,
        stream: true,
        wallMs: manifest.budgets.participantWallMs,
        transport: wrapped,
      });
      // exchange's wall race may finish before transport's abort-finally archive.
      // Give the trusted transport bounded time to finalize; never dispatch again.
      if (inFlight) {
        const finalized = await boundedWait(
          inFlight.then(
            () => true,
            () => true
          ),
          5000
        );
        assert.equal(finalized, true, 'Transport finalization deadline exceeded');
      }
      exchangeResult.receipt.origin = origin;
      exchangeResult.receipt.synthetic = mode === 'offline-synthetic';
      exchangeResult.receipt.transportEvidence =
        typeof transport.evidence === 'function' ? transport.evidence() : null;
      await save(slotDir, 'exchange.json', exchangeResult.receipt);
      row.participantMs =
        Date.parse(exchangeResult.receipt.finished) - Date.parse(exchangeResult.receipt.started);
      row.receivingStatus = exchangeResult.receipt.outcome;
      row.error = exchangeResult.receipt.error;
      const metadata = await auditHttp(
        path.join(slotDir, 'http'),
        entry.requestBytes,
        row.receivingStatus === 'completed'
      );
      await save(slotDir, 'archive-check.json', {
        status: 'integrity-verified',
        rawComplete: metadata.rawBodyComplete,
        rawBytes: metadata.rawBodyBytes,
        files: metadata.files,
        origin,
      });
      let response = exchangeResult.receipt.response;
      if (!response && metadata.files.some((f) => f.name === 'response.terminal.json'))
        response = JSON.parse(
          await readFile(path.join(slotDir, 'http', 'response.terminal.json'), 'utf8')
        );
      row.reportedSettings = observedSettings(response);
      const drift = response
        ? settingDifference(firstSettings, row.reportedSettings, manifest)
        : null;
      if (response) {
        if (!firstSettings) firstSettings = { ...row.reportedSettings };
        else
          for (const key of Object.keys(firstSettings))
            if (firstSettings[key] == null) firstSettings[key] = row.reportedSettings[key];
      }
      Object.assign(row, usageReference(response?.usage));
      if (mode === 'offline-synthetic')
        row.usageBasis = response?.usage
          ? 'explicit-synthetic-fixture-usage'
          : 'unavailable-synthetic-fixture';
      if (row.referenceUSD != null) ledger.referenceKnownUSD += row.referenceUSD;
      row.reportedSettingsConsistent = drift == null;
      if (drift) {
        row.stopReason = drift;
        ledger.stopReason = drift;
      }
      if (response?.usage && response.usage.output_tokens > manifest.wire.max_output_tokens)
        ledger.stopReason = row.stopReason = 'reported-output-over-requested-cap';
      if (mode === 'live-participant' && row.referenceUSD == null)
        ledger.stopReason = row.stopReason = 'usage-ambiguity-stop';
      if (!metadata.rawBodyComplete || !called)
        ledger.stopReason = row.stopReason = 'uncertain-dispatch-or-incomplete-receipt';
      if (row.receivingStatus === 'completed') {
        await writeFile(path.join(slotDir, 'submission.txt'), exchangeResult.receipt.text, {
          flag: 'wx',
        });
        let html;
        try {
          html = standaloneHtml(exchangeResult.receipt.text);
        } catch (error) {
          row.receivingStatus = 'invalid-deliverable';
          row.error = error.message;
        }
        if (html) {
          const htmlPath = path.join(slotDir, 'submission.html');
          await writeFile(htmlPath, html, { flag: 'wx' });
          const beforeWorker = now();
          const assessment = await assess({
            htmlPath,
            evidenceDir: path.join(slotDir, 'browser'),
            chromiumPath: manifest.executionConfig.chromiumPath,
            wallMs: manifest.budgets.browserWallMs,
          });
          row.workerMs = now() - beforeWorker;
          await save(slotDir, 'assessment.json', assessment);
          Object.assign(row, summarizedChecks(manifest, assessment));
          if (!row.scoringEligible)
            row.error = assessment?.worker?.eligibility?.reason ?? 'Scoring unavailable';
          if (assessment?.worker?.deadlineExceeded)
            ledger.stopReason = row.stopReason = 'browser-deadline-exhausted';
          if (assessment?.result?.evidence?.status !== 'complete')
            ledger.stopReason = row.stopReason = 'scoring-evidence-incomplete';
          if (
            assessment?.worker?.cleanupError ||
            assessment?.worker?.cleanup?.some((c) => c.status !== 'no-live-group-members')
          )
            ledger.stopReason = row.stopReason = 'worker-cleanup-failure';
        }
      }
      row.totalMs = now() - attemptStart;
      await save(slotDir, 'result-row.json', row);
    } catch (error) {
      row.error = error.message;
      row.receivingStatus = row.dispatched ? 'execution-or-evidence-error' : 'pre-dispatch-failure';
      row.totalMs = attemptStart == null ? null : now() - attemptStart;
      row.stopReason = ledger.stopReason = row.dispatched
        ? 'uncertain-dispatch-or-evidence-failure'
        : 'pre-dispatch-integrity-or-route-failure';
      if (row.attempted)
        await save(slotDir, 'exception.json', {
          origin,
          phase: row.dispatched ? 'execution' : 'construction',
          error: row.error,
          stopReason: row.stopReason,
        });
    }
    await checkpoint();
  }
  ledger.finished = new Date(now()).toISOString();
  ledger.coverage = {
    planned: 9,
    attempted: ledger.rows.filter((r) => r.attempted).length,
    dispatched: ledger.dispatches,
    scorable: ledger.rows.filter((r) => r.scoringEligible).length,
    allPassed: ledger.rows.filter((r) => r.allPassed).length,
    notRun: ledger.rows.filter((r) => !r.attempted).length,
  };
  await checkpoint();
  await writeFile(path.join(executionDirectory, 'RESULTS.md'), markdown(ledger), { flag: 'wx' });
  return ledger;
}
