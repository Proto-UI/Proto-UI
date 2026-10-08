import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { boundedTabs } from '../semantic/bounded-worker.mjs';
import { inspectBatch, jsonBytes, sha256 } from './batch-plan.mjs';
import { batchReport } from './batch-report.mjs';
import { exchange } from './no-tools.mjs';
import { discoveryProperties } from './task-packets.mjs';

const save = (dir, name, value) =>
  writeFile(path.join(dir, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
// Construction is trusted coordinator work, not a provider call. The signal and
// race bound waiting only: a blocking JS callback or ignored cancellation is not
// forcibly terminated. A late factory result is never dispatched by this runner.
async function construct(factory, options, wallMs) {
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(() => factory({ ...options, signal: controller.signal })),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error('Transport construction deadline exceeded'));
        }, wallMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
async function assess({ task, text, directory, chromiumPath, remainingMs }) {
  if (task === 'discovery') {
    try {
      const proposal = discoveryProperties(text);
      await save(directory, 'proposal.json', proposal);
      return {
        status: 'proposal-structure-valid',
        proposedProperties: proposal.properties.length,
        semanticCrosswalk: 'pending-independent-review',
        layers: null,
      };
    } catch (e) {
      return {
        status: 'invalid-submission',
        error: e.message,
        proposedProperties: null,
        semanticCrosswalk: 'unavailable',
        layers: null,
      };
    }
  }
  if (!/^\s*<!doctype html>/i.test(text) || Buffer.byteLength(text) > 1_000_000)
    return {
      status: 'invalid-submission',
      error: 'Standalone HTML doctype/1MB bound required',
      layers: null,
    };
  if (!chromiumPath || remainingMs < 100)
    return {
      status: 'blocked',
      error: 'Verified browser or remaining assessment budget unavailable',
      layers: null,
    };
  try {
    const receipt = await boundedTabs({
      htmlPath: path.join(directory, 'participant.txt'),
      evidenceDir: path.join(directory, 'browser'),
      chromiumPath,
      wallMs: Math.min(45000, remainingMs),
    });
    if (receipt.outcome !== 'completed')
      return {
        status: 'blocked',
        error: 'Browser assessment did not complete',
        worker: receipt,
        layers: null,
      };
    const result = JSON.parse(await readFile(path.join(directory, 'browser', 'result.json')));
    return {
      status: 'candidate-observations',
      oracleAdmission: result.admission,
      worker: receipt,
      layers: result.summary,
      checks: result.checks,
    };
  } catch (e) {
    return { status: 'blocked', error: e.message, layers: null };
  }
}

/** Trusted-coordinator adapter, never a billing authorization mechanism. No
 * credentials/provider selection built in. Caller must already possess current
 * human authorization before injecting any actual paid/live transport. This
 * module cannot prove that authorization or provider origin from an artifact.
 * All local proof runs use executionClass=synthetic-controls. Non-synthetic
 * attempts remain origin-unreviewed and never automatically count as real runs.
 */
export async function executeCandidateBatch({
  planDir,
  expectedSha256,
  directory,
  transportFactory,
  executionClass = 'synthetic-controls',
  chromiumPath,
}) {
  assert.ok(['synthetic-controls', 'provider-attempts-unreviewed'].includes(executionClass));
  assert.equal(typeof transportFactory, 'function');
  assert.ok(path.isAbsolute(directory));
  const plan = deepFreeze(await inspectBatch({ directory: planDir, expectedSha256 }));
  await mkdir(directory);
  const started = Date.now();
  const deadline = started + plan.controls.totalWallMs;
  const journal = {
    schemaVersion: 1,
    kind: 'proto-ui.noncompiler-candidate-execution',
    admission: 'not-admitted',
    executionClass,
    planSha256: expectedSha256,
    started: new Date(started).toISOString(),
    finished: null,
    attemptsReserved: 0,
    results: [],
  };
  await save(directory, 'execution-start.json', { ...journal, plannedRuns: plan.runs });
  for (const run of plan.runs) {
    const row = {
      ...run,
      participantOutcome: 'not-executed',
      reason: null,
      receipt: null,
      assessment: null,
      textSha256: null,
      reservation: null,
      participantInvoked: false,
    };
    journal.results.push(row);
    const dir = path.join(directory, run.id);
    await mkdir(dir);
    let remaining = deadline - Date.now();
    if (journal.attemptsReserved >= plan.controls.attemptCap || remaining <= 0) {
      row.reason = remaining <= 0 ? 'batch-deadline-exhausted' : 'attempt-cap-exhausted';
      await save(dir, 'result.json', row);
      continue;
    }
    try {
      // Revalidate before every attempt; do not admit later runs after source drift.
      await inspectBatch({ directory: planDir, expectedSha256 });
      remaining = deadline - Date.now();
      if (remaining <= 0) {
        row.reason = 'batch-deadline-exhausted';
        await save(dir, 'result.json', row);
        continue;
      }
      const reservation = ++journal.attemptsReserved;
      row.reservation = reservation; // Conservative: constructor errors consume a slot.
      await save(dir, 'reservation.json', {
        id: run.id,
        reservation,
        requestSha256: run.requestSha256,
      });
      const transport = await construct(
        transportFactory,
        { run: { ...run }, archiveDir: path.join(dir, 'http-attempt') },
        Math.min(plan.controls.wallMs, Math.max(1, deadline - Date.now()))
      );
      assert.equal(typeof transport, 'function');
      remaining = deadline - Date.now();
      if (remaining <= 0) {
        row.reason = 'batch-deadline-exhausted-after-construction';
        await save(dir, 'result.json', row);
        continue;
      }
      const boundedTransport = (body, signal) => {
        assert.equal(sha256(jsonBytes(body)), run.requestSha256, 'Wire request binding changed');
        row.participantInvoked = true;
        return transport(deepFreeze(body), signal);
      };
      if (typeof transport.evidence === 'function')
        boundedTransport.evidence = () => transport.evidence();
      await save(dir, 'dispatch-intent.json', {
        id: run.id,
        requestSha256: run.requestSha256,
        reservation,
      });
      const output = await exchange({
        packet: plan.packets[run.task][run.condition],
        model: plan.model,
        maxOutputTokens: plan.controls.maxOutputTokens,
        stream: plan.controls.stream,
        wallMs: Math.max(1, Math.min(plan.controls.wallMs, deadline - Date.now())),
        transport: boundedTransport,
      });
      row.receipt = output.receipt;
      row.participantOutcome = output.receipt.outcome;
      assert.equal(row.receipt.requestSha256, run.requestSha256, 'Exchange request differs');
      await save(dir, 'exchange.json', output);
      if (output.receipt.text !== null) {
        await writeFile(path.join(dir, 'participant.txt'), output.receipt.text, { flag: 'wx' });
        row.textSha256 = sha256(output.receipt.text);
        row.assessment = await assess({
          task: run.task,
          text: output.receipt.text,
          directory: dir,
          chromiumPath,
          remainingMs: Math.max(0, deadline - Date.now()),
        });
      }
    } catch (e) {
      row.participantOutcome = row.receipt?.outcome ?? 'coordinator-failed';
      row.reason = e.message;
    }
    await save(dir, 'result.json', row);
  }
  journal.finished = new Date().toISOString();
  await save(directory, 'execution.json', journal);
  const report = batchReport({ plan, execution: journal });
  await save(directory, 'report.json', report);
  return { directory, report };
}

/** Read-only interruption inspection. No resume/retry, no inferred success, and
 * no missing result treated as an unexecuted request: a dispatch intent may
 * precede an actual invocation or a crash. Keep this uncertainty explicit.
 */
export async function inspectInterruptedBatch({ planDir, expectedSha256, directory }) {
  const plan = await inspectBatch({ directory: planDir, expectedSha256 });
  const artifactErrors = [];
  async function optional(name) {
    try {
      return JSON.parse(await readFile(path.join(directory, name)));
    } catch (e) {
      if (e.code !== 'ENOENT')
        artifactErrors.push({ name, code: e.code ?? 'invalid-json', error: e.message });
      return null;
    }
  }
  const start = await optional('execution-start.json');
  assert.equal(start?.planSha256, expectedSha256, 'Execution start binding mismatch');
  assert.deepEqual(start.plannedRuns, plan.runs);
  const terminal = await optional('execution.json');
  const report = await optional('report.json');
  if (terminal) {
    assert.equal(terminal.planSha256, expectedSha256);
    batchReport({ plan, execution: terminal });
  }
  if (report) assert.equal(report.planSha256, expectedSha256);
  const slots = [];
  for (const run of plan.runs) {
    const result = await optional(`${run.id}/result.json`);
    const reservation = await optional(`${run.id}/reservation.json`);
    const dispatchIntent = await optional(`${run.id}/dispatch-intent.json`);
    for (const artifact of [result, reservation, dispatchIntent].filter(Boolean)) {
      assert.equal(artifact.id, run.id);
      assert.equal(artifact.requestSha256, run.requestSha256);
    }
    slots.push({
      id: run.id,
      result,
      reservation,
      dispatchIntent,
      status: result ? 'terminal-row-present-unverified' : 'unresolved',
      actualInvocation: result ? result.participantInvoked : null,
    });
  }
  return {
    admission: 'not-admitted',
    artifactErrors,
    status:
      terminal && report && artifactErrors.length === 0
        ? 'terminal-artifacts-present-unverified'
        : 'incomplete',
    planSha256: expectedSha256,
    slots,
    automaticResume: false,
    limitations:
      'Artifact existence and hashes do not authenticate execution; unresolved slots cannot be scored or retried automatically',
  };
}
