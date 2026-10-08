import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { executeSupplement } from './supplement-runner.mjs';
import { inspectSupplement } from './supplement-plan.mjs';
import { sha256 } from './nine-plan.mjs';
import { responsesTransport } from './http-transport.mjs';
// Explicit synthetic fixture encoder, not a provider or model response generator.
function stream(
  text,
  index,
  model = 'gpt-6.1-sol',
  usage = { input_tokens: 400, output_tokens: 600 }
) {
  const id = `synthetic-response-${index}`;
  const item_id = `synthetic-message-${index}`;
  const part = { type: 'output_text', text, annotations: [], logprobs: [] };
  const item = {
    id: item_id,
    type: 'message',
    role: 'assistant',
    status: 'completed',
    content: [part],
  };
  const events = [
    { type: 'response.created', response: { id, model, status: 'in_progress', output: [] } },
    { type: 'response.in_progress', response: { id, model, status: 'in_progress' } },
    {
      type: 'response.output_item.added',
      output_index: 0,
      item: { ...item, status: 'in_progress', content: [] },
    },
    {
      type: 'response.content_part.added',
      output_index: 0,
      item_id,
      content_index: 0,
      part: { type: 'output_text', text: '' },
    },
    { type: 'response.output_text.delta', output_index: 0, item_id, content_index: 0, delta: text },
    { type: 'response.output_text.done', output_index: 0, item_id, content_index: 0, text },
    { type: 'response.content_part.done', output_index: 0, item_id, content_index: 0, part },
    { type: 'response.output_item.done', output_index: 0, item },
    {
      type: 'response.completed',
      response: {
        id,
        model,
        status: 'completed',
        output: [],
        ...stream.settings,
        error: null,
        incomplete_details: null,
        usage,
      },
    },
  ];
  return Buffer.from(
    events
      .map(
        (e, sequence_number) =>
          `event: ${e.type}\ndata: ${JSON.stringify({ ...e, sequence_number })}\n\n`
      )
      .join('')
  );
}
const json = (v) => JSON.stringify(v, null, 2) + '\n';
export async function rehearseSupplement({
  directory,
  manifestSha256,
  sourceRoot,
  evidenceRoot,
  positiveHtmlPath,
  negativeHtmlPath,
}) {
  const { manifest } = await inspectSupplement({ directory, manifestSha256, sourceRoot });
  await mkdir(evidenceRoot);
  // Deliberately reorder reasoning object keys; equal settings must not false-stop.
  stream.settings = {
    ...manifest.settingsBaseline,
    reasoning: { summary: null, mode: 'standard', effort: 'medium', context: 'all_turns' },
  };
  delete stream.settings.model;
  const positive = await readFile(positiveHtmlPath, 'utf8'),
    negative = await readFile(negativeHtmlPath, 'utf8');
  const hostError = positive.replace(
    '</body>',
    "<script>queueMicrotask(()=>{throw new Error('Explicit synthetic host error');});</script></body>"
  );
  assert.notEqual(hostError, positive);
  const fixtures = [
    positive,
    negative,
    'explicit synthetic invalid deliverable',
    hostError,
    `\`\`\`html\n${positive.trim()}\n\`\`\``,
    null,
  ];
  await mkdir(path.join(evidenceRoot, 'fixtures'));
  for (const [index, text] of fixtures.entries())
    await writeFile(
      path.join(evidenceRoot, 'fixtures', `${index + 1}.raw`),
      text == null
        ? Buffer.from('event: response.completed\ndata: {deliberately-broken}\n\n')
        : stream(text, index),
      { flag: 'wx' }
    );
  const offlineAuthorization = {
    approved: true,
    manifestSha256,
    mode: 'offline-synthetic',
    maxDispatches: 6,
    retries: 0,
  };
  const scenario = async (name, handler, options = {}) => {
    const requests = [];
    const server = createServer(async (req, res) => {
      const chunks = [];
      for await (const b of req) chunks.push(b);
      assert.equal(req.headers.authorization, 'Bearer LOCAL-SYNTHETIC-TEST-SECRET');
      requests.push(Buffer.concat(chunks));
      await handler(res, requests.length);
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    let ledger;
    try {
      const endpoint = `http://127.0.0.1:${server.address().port}/responses`;
      ledger = await executeSupplement({
        directory,
        manifestSha256,
        sourceRoot,
        executionDirectory: path.join(evidenceRoot, name),
        mode: options.mode ?? 'offline-synthetic',
        authorization: options.authorization ?? offlineAuthorization,
        observeRoute: async () => ({ routeFingerprint: manifest.executionConfig.routeFingerprint }),
        transportFactory: ({ archiveDir }) =>
          responsesTransport({
            endpoint,
            archiveDir,
            token: 'LOCAL-SYNTHETIC-TEST-SECRET',
            allowLoopbackHttp: true,
            requestTimeoutMs: options.timeoutMs ?? 180000,
            maxResponseBytes: 4000000,
          }),
      });
    } finally {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
    assert.equal(requests.length, ledger.dispatches);
    const wire = [];
    for (const [index, raw] of requests.entries()) {
      const row = ledger.rows[index];
      const approved = await readFile(
        path.join(manifest.parent.directory, manifest.packets[row.condition].request.path)
      );
      assert.ok(raw.equals(approved), 'Synthetic server observed nonfrozen bytes');
      wire.push({
        id: row.id,
        condition: row.condition,
        sha256: sha256(raw),
        exactParentFrozenWire: true,
      });
    }
    await writeFile(
      path.join(evidenceRoot, name, 'wire-observations.json'),
      json({ synthetic: true, externalModelCalls: 0, wire }),
      { flag: 'wx' }
    );
    return ledger;
  };
  const mixed = await scenario('mixed-six', (res, index) =>
    readFile(path.join(evidenceRoot, 'fixtures', `${index}.raw`)).then((raw) => res.end(raw))
  );
  assert.equal(mixed.dispatches, 6);
  assert.equal(mixed.participantProviderCalls, 0);
  assert.equal(mixed.coverage.scorable, 3);
  assert.equal(mixed.coverage.allPassed, 2);
  assert.equal(mixed.coverage.notRun, 0);
  assert.equal(mixed.stopReason, null);
  assert.equal(mixed.rows[1].scoringEligible, true);
  assert.ok(mixed.rows[1].corePassed < 15);
  assert.equal(mixed.rows[2].receivingStatus, 'invalid-deliverable');
  assert.equal(mixed.rows[3].scoringEligible, false);
  assert.equal(mixed.rows[5].receivingStatus, 'failed');
  const interrupted = await scenario('interrupted-stop', (res, index) =>
    index === 2 ? res.destroy() : res.end(stream('synthetic invalid deliverable', index))
  );
  assert.equal(interrupted.dispatches, 2);
  assert.ok(interrupted.stopReason);
  assert.equal(interrupted.coverage.notRun, 4);
  const timeout = await scenario(
    'timeout-stop',
    (res, index) =>
      index === 2
        ? res.write('event: incomplete\ndata: ')
        : res.end(stream('synthetic invalid deliverable', index)),
    { timeoutMs: 100 }
  );
  assert.equal(timeout.dispatches, 2);
  assert.ok(timeout.stopReason);
  const drift = await scenario('model-stop', (res, index) =>
    res.end(
      stream(
        'synthetic invalid deliverable',
        index,
        index === 2 ? 'changed-synthetic-model' : 'gpt-6.1-sol'
      )
    )
  );
  assert.equal(drift.dispatches, 2);
  assert.equal(drift.stopReason, 'returned-model-mismatch');
  const outputCap = await scenario('cap-stop', (res, index) =>
    res.end(
      stream('synthetic invalid deliverable', index, 'gpt-6.1-sol', {
        input_tokens: 10,
        output_tokens: 8193,
      })
    )
  );
  assert.equal(outputCap.dispatches, 1);
  assert.equal(outputCap.stopReason, 'reported-output-over-requested-cap');
  const fees = await scenario('no-fee-stop', (res, index) =>
    res.end(
      stream('synthetic invalid deliverable', index, 'gpt-6.1-sol', {
        input_tokens: 600000,
        output_tokens: 10,
      })
    )
  );
  assert.equal(fees.dispatches, 6);
  assert.ok(fees.referenceKnownUSD > 1);
  assert.equal(fees.stopReason, null);
  // Explicit local synthetic exercise of the unchanged live missing-usage branch.
  // This bypasses the authenticated wrapper and sends ONLY to this local server;
  // its internal live-mode ledger counter is not actual participant/provider use.
  const probeReviewPath = path.join(evidenceRoot, 'SYNTHETIC-policy-review.json');
  const probeReviewBytes = Buffer.from(
    json({
      verdict: 'APPROVE',
      manifestSha256,
      synthetic: true,
      notIndependentReview: true,
      notLiveExecutionGrant: true,
    })
  );
  await writeFile(probeReviewPath, probeReviewBytes, { flag: 'wx' });
  const probeAuthorization = {
    approved: true,
    manifestSha256,
    mode: 'live-participant',
    maxDispatches: 6,
    retries: 0,
    routeFingerprint: manifest.executionConfig.routeFingerprint,
    moneyRisk: {
      explicitUserApproval: true,
      unknownActualBillingAccepted: true,
      referenceEnvelopeIsNotHardCap: true,
      noNewCreditPurchase: true,
      costLimitsRemovedByUser: true,
    },
    allowUnknownUsage: false,
    userDecisionReference: manifest.authorization.path,
    reviewReference: probeReviewPath,
    reviewSha256: sha256(probeReviewBytes),
  };
  const usageStop = await scenario(
    'SYNTHETIC-live-policy-no-provider',
    (res, index) => res.end(stream('synthetic invalid deliverable', index, 'gpt-6.1-sol', null)),
    { mode: 'live-participant', authorization: probeAuthorization }
  );
  assert.equal(usageStop.dispatches, 1);
  assert.equal(usageStop.stopReason, 'usage-ambiguity-stop');
  assert.equal(usageStop.coverage.notRun, 5);
  const files = await readdir(evidenceRoot, { recursive: true, withFileTypes: true });
  for (const f of files.filter((f) => f.isFile()))
    assert.equal(
      (await readFile(path.join(f.parentPath, f.name))).includes(
        Buffer.from('LOCAL-SYNTHETIC-TEST-SECRET')
      ),
      false
    );
  const report = {
    kind: 'six-supplement-offline-real-http-browser-e2e',
    synthetic: true,
    passed: true,
    participantProviderCalls: 0,
    externalModelCalls: 0,
    manifestSha256,
    allRequestsExactParentWire: true,
    mixedSix: {
      dispatches: 6,
      scorable: 3,
      allPassed: 2,
      unscorable: 3,
      negativeScorableRetained: true,
      malformedRawRetained: true,
    },
    stopCases: [interrupted, timeout, drift, outputCap, usageStop].map((l) => ({
      synthetic: true,
      externalModelCalls: 0,
      dispatches: l.dispatches,
      stopReason: l.stopReason,
      notRun: l.coverage.notRun,
    })),
    feesAreMeasurementOnly: {
      dispatches: fees.dispatches,
      referenceUSD: fees.referenceKnownUSD,
      stopped: false,
    },
    credentialScan: { syntheticSecretAbsent: true, files: files.filter((f) => f.isFile()).length },
    limitations: [
      'Offline fixtures are not fresh model results',
      'Live-policy ledger is local synthetic branch exercise, not provider calls or live admission',
      'No authentication/invoice/upstream retry conclusion',
    ],
  };
  await writeFile(path.join(evidenceRoot, 'rehearsal-result.json'), json(report), { flag: 'wx' });
  return report;
}
