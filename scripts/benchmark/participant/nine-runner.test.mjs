import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { prepareNineRevision, sha256 } from './nine-plan.mjs';
import {
  executeNine,
  standaloneHtml,
  usageReference,
  validateNineAuthorization,
} from './nine-runner.mjs';
import { responsesTransport } from './http-transport.mjs';

const sourceRoot = fileURLToPath(new URL('../../../', import.meta.url));
const parentDirectory = process.env.PROTO_NINE_PLAN_FIXTURE;
const parentSha256 = '93bfa977097698b6c15048a5db33ed8dd606a7ac6ee0a3716cc92aaa298d6be5';
const html =
  '<!doctype html><html><head></head><body>Explicit synthetic unit fixture</body></html>';
export function syntheticStream(
  text = html,
  model = 'gpt-6.1-sol',
  usage = { input_tokens: 20, output_tokens: 30 }
) {
  const itemId = 'synthetic-message';
  const part = { type: 'output_text', text, annotations: [], logprobs: [] };
  const item = {
    id: itemId,
    type: 'message',
    role: 'assistant',
    status: 'completed',
    content: [part],
  };
  const response = {
    id: 'synthetic-response',
    model,
    status: 'completed',
    output: [],
    error: null,
    incomplete_details: null,
    usage,
  };
  const events = [
    {
      type: 'response.created',
      response: { id: response.id, model, status: 'in_progress', output: [] },
    },
    { type: 'response.in_progress', response: { id: response.id, model, status: 'in_progress' } },
    {
      type: 'response.output_item.added',
      output_index: 0,
      item: { ...item, status: 'in_progress', content: [] },
    },
    {
      type: 'response.content_part.added',
      output_index: 0,
      item_id: itemId,
      content_index: 0,
      part: { type: 'output_text', text: '' },
    },
    {
      type: 'response.output_text.delta',
      output_index: 0,
      item_id: itemId,
      content_index: 0,
      delta: text,
    },
    { type: 'response.output_text.done', output_index: 0, item_id: itemId, content_index: 0, text },
    {
      type: 'response.content_part.done',
      output_index: 0,
      item_id: itemId,
      content_index: 0,
      part,
    },
    { type: 'response.output_item.done', output_index: 0, item },
    { type: 'response.completed', response },
  ];
  return Buffer.from(
    events
      .map(
        (event, sequence_number) =>
          `event: ${event.type}\ndata: ${JSON.stringify({ ...event, sequence_number })}\n\n`
      )
      .join('')
  );
}
async function prepare(directory, config = {}, policy = {}) {
  return prepareNineRevision({
    parentDirectory,
    parentSha256,
    directory,
    sourceRoot,
    seed: sha256('fixed synthetic runner test seed'),
    executionConfig: {
      endpoint: 'http://127.0.0.1:15721/v1/responses',
      routeFingerprint: sha256('synthetic route'),
      chromiumPath: '/synthetic/chrome',
      ...config,
    },
    budgetPolicy: {
      admission: 'blocked-until-user-fee-decision',
      referenceEnvelopeUSD: 1,
      referenceEnvelopeIsNotHardCap: true,
      actualBillingUSD: null,
      ...policy,
    },
    additionalSources: [
      'scripts/benchmark/participant/nine-runner.mjs',
      'scripts/benchmark/participant/nine-runner.test.mjs',
    ],
  });
}
async function fixture(handler, run) {
  let calls = 0;
  const requests = [];
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks);
    requests.push(raw);
    calls++;
    handler({ req, res, calls, raw });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    return await run({
      endpoint: `http://127.0.0.1:${server.address().port}/responses`,
      calls: () => calls,
      requests,
    });
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}
async function runCase(
  handler,
  { factory, assess, mode = 'offline-synthetic', authorization, observeRoute, policy } = {}
) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nine-synthetic-'));
  const frozen = await prepare(path.join(root, 'plan'), {}, policy);
  const auth = authorization ?? {
    approved: true,
    manifestSha256: frozen.manifestSha256,
    mode,
    maxDispatches: 9,
    retries: 0,
  };
  return fixture(handler, async ({ endpoint, calls, requests }) => {
    const ledger = await executeNine({
      directory: frozen.directory,
      manifestSha256: frozen.manifestSha256,
      sourceRoot,
      executionDirectory: path.join(root, 'execution'),
      mode,
      authorization: auth,
      observeRoute,
      transportFactory:
        factory ??
        (({ archiveDir }) =>
          responsesTransport({
            endpoint,
            archiveDir,
            token: 'SYNTHETIC-CREDENTIAL-NOT-EVIDENCE',
            allowLoopbackHttp: true,
            requestTimeoutMs: 1000,
            maxResponseBytes: 4_000_000,
          })),
      assess:
        assess ??
        (async () => ({
          worker: {
            eligibility: { scoringEligible: true },
            cleanup: [{ status: 'no-live-group-members' }, { status: 'no-live-group-members' }],
          },
          result: {
            execution: 'completed',
            evidence: { status: 'complete' },
            checks: frozen.manifest.coreInventory.map(({ id }) => ({ id, status: 'pass' })),
          },
        })),
    });
    return { ledger, calls: calls(), requests, root, frozen };
  });
}
test('one document/fence only; no salvage or multiple candidates', () => {
  assert.equal(standaloneHtml(html), html);
  assert.equal(standaloneHtml('```html\n' + html + '\n```'), html);
  for (const text of [
    'prefix\n' + html,
    html.replace('</html>', ''),
    html + html,
    '```html\n' + html + '\n```\n```html\n' + html + '\n```',
  ])
    assert.throws(() => standaloneHtml(text));
});
test('usage conditional reference is not actual cost or missing-as-zero', () => {
  assert.equal(usageReference(null).referenceUSD, null);
  assert.equal(usageReference({ input_tokens: -1, output_tokens: 2 }).referenceUSD, null);
  const ref = usageReference({
    input_tokens: 100,
    output_tokens: 50,
    input_tokens_details: { cached_tokens: 40 },
  });
  assert.equal(ref.referenceUSD, 0.000624);
  assert.equal(ref.actualUSD, null);
});
test('live approval cannot inherit old plan, synthetic permission or contain credentials', () => {
  const manifest = { executionConfig: { routeFingerprint: 'r' } };
  const auth = {
    approved: true,
    manifestSha256: 'h',
    mode: 'offline-synthetic',
    maxDispatches: 9,
    retries: 0,
  };
  assert.throws(() =>
    validateNineAuthorization({
      authorization: auth,
      manifestSha256: 'h',
      manifest,
      mode: 'live-participant',
    })
  );
  assert.throws(() =>
    validateNineAuthorization({
      authorization: { ...auth, token: 'never' },
      manifestSha256: 'h',
      manifest,
      mode: 'offline-synthetic',
    })
  );
  const live = {
    ...auth,
    mode: 'live-participant',
    routeFingerprint: 'r',
    allowUnknownUsage: false,
    userDecisionReference: '/trusted/user-decision.json',
    moneyRisk: {
      explicitUserApproval: true,
      unknownActualBillingAccepted: true,
      referenceEnvelopeIsNotHardCap: true,
      noNewCreditPurchase: true,
    },
  };
  validateNineAuthorization({
    authorization: live,
    manifestSha256: 'h',
    manifest,
    mode: 'live-participant',
  });
  assert.throws(() =>
    validateNineAuthorization({
      authorization: { ...live, moneyRisk: { ...live.moneyRisk, explicitUserApproval: false } },
      manifestSha256: 'h',
      manifest,
      mode: 'live-participant',
    })
  );
});
test(
  'nine offline HTTP exchanges, exact wires/raw/assembly and no credentials in evidence',
  { skip: !parentDirectory },
  async () => {
    const result = await runCase(({ res }) => res.end(syntheticStream()));
    assert.equal(result.calls, 9);
    assert.equal(result.ledger.dispatches, 9);
    assert.equal(result.ledger.participantProviderCalls, 0);
    assert.equal(result.ledger.coverage.scorable, 9);
    for (const row of result.ledger.rows) {
      const request = await readFile(
        path.join(
          result.frozen.directory,
          result.frozen.manifest.packets[row.condition].request.path
        )
      );
      assert.ok(result.requests[result.ledger.rows.indexOf(row)].equals(request));
      assert.equal(row.corePassed, 15);
      assert.equal(row.checks.length, 15);
      for (const file of [
        'response.raw',
        'response.terminal.json',
        'response.assembled.json',
        'response.assembly.json',
        'transport.json',
      ])
        await readFile(path.join(result.root, 'execution', row.id, 'http', file));
    }
    const allFiles = await readdir(path.join(result.root, 'execution'), {
      recursive: true,
      withFileTypes: true,
    });
    for (const entry of allFiles.filter((d) => d.isFile())) {
      const text = await readFile(path.join(entry.parentPath, entry.name), 'utf8');
      assert.ok(!text.includes('SYNTHETIC-CREDENTIAL-NOT-EVIDENCE'));
    }
  }
);
test(
  'semantic failures stay scorable; invalid deliverables and host errors retain full rows',
  { skip: !parentDirectory },
  async () => {
    let assessmentCalls = 0;
    const result = await runCase(
      ({ calls, res }) =>
        res.end(syntheticStream(calls === 2 ? 'invalid synthetic document' : html)),
      {
        assess: async () => {
          assessmentCalls++;
          const fail = assessmentCalls === 1;
          const hostError = assessmentCalls === 2;
          return {
            worker: { eligibility: { scoringEligible: !hostError } },
            result: {
              evidence: { status: 'complete' },
              checks: resultCriteria().map((id, i) => ({
                id,
                status: fail && i === 0 ? 'fail' : 'pass',
              })),
            },
          };
        },
      }
    );
    function resultCriteria() {
      return [
        'initial-structure',
        'settings-defaults',
        'horizontal-clamp',
        'horizontal-wrap',
        'orientation-live',
        'vertical-clamp',
        'vertical-wrap',
        'home-end',
        'manual-focus',
        'enter-activation',
        'space-activation',
        'pointer-repeat',
        'disabled-suppression',
        'retained-relationships',
        'cleanup-after',
      ];
    }
    assert.equal(result.calls, 9);
    assert.equal(result.ledger.rows[0].scoringEligible, true);
    assert.equal(result.ledger.rows[0].corePassed, 14);
    assert.equal(result.ledger.rows[0].allPassed, false);
    assert.equal(result.ledger.rows[1].receivingStatus, 'invalid-deliverable');
    assert.equal(result.ledger.rows[1].scoringEligible, false);
    assert.equal(result.ledger.rows[2].scoringEligible, false);
    assert.equal(result.ledger.rows[2].corePassed, null);
  }
);
test(
  'malformed complete stream is retained without retry or invented score',
  { skip: !parentDirectory },
  async () => {
    const result = await runCase(({ calls, res }) =>
      res.end(calls === 2 ? 'event: response.completed\ndata: {broken}\n\n' : syntheticStream())
    );
    assert.equal(result.calls, 9);
    assert.equal(result.ledger.rows[1].receivingStatus, 'failed');
    assert.equal(result.ledger.rows[1].scoringEligible, false);
    assert.equal(result.ledger.rows[1].corePassed, null);
    const raw = await readFile(
      path.join(result.root, 'execution', result.ledger.rows[1].id, 'http', 'response.raw'),
      'utf8'
    );
    assert.ok(raw.includes('{broken}'));
  }
);
test(
  'constructor failure consumes reservation, zero dispatch and eight not-run rows',
  { skip: !parentDirectory },
  async () => {
    const result = await runCase(() => {}, {
      factory: () => {
        throw new Error('synthetic constructor failure');
      },
    });
    assert.equal(result.calls, 0);
    assert.equal(result.ledger.coverage.attempted, 1);
    assert.equal(result.ledger.coverage.notRun, 8);
    assert.equal(result.ledger.dispatches, 0);
  }
);
test(
  'interrupted HTTP counts uncertain dispatch and stops, no replacement',
  { skip: !parentDirectory },
  async () => {
    const result = await runCase(({ calls, res }) =>
      calls === 2 ? res.destroy() : res.end(syntheticStream())
    );
    assert.equal(result.calls, 2);
    assert.equal(result.ledger.dispatches, 2);
    assert.equal(result.ledger.coverage.notRun, 7);
    assert.equal(result.ledger.rows[1].scoringEligible, false);
    assert.ok(result.ledger.stopReason);
  }
);
test(
  'reported identity changes stop future dispatches, unknown defaults alone do not',
  { skip: !parentDirectory },
  async () => {
    const result = await runCase(({ calls, res }) =>
      res.end(syntheticStream(html, calls === 2 ? 'different-model' : 'gpt-6.1-sol'))
    );
    assert.equal(result.calls, 2);
    assert.equal(result.ledger.stopReason, 'returned-model-mismatch');
    assert.equal(result.ledger.coverage.notRun, 7);
  }
);
test(
  'reference envelope threshold stops future dispatches, no hard-cap assertion',
  { skip: !parentDirectory },
  async () => {
    const result = await runCase(({ res }) =>
      res.end(syntheticStream(html, 'gpt-6.1-sol', { input_tokens: 600000, output_tokens: 10 }))
    );
    assert.equal(result.calls, 1);
    assert.equal(result.ledger.stopReason, 'reference-envelope-exhausted-not-monetary-cap');
    assert.equal(result.ledger.actualUSD, null);
  }
);

test(
  'explicit no-fee-limit amendment permits all nine after reference USD1 is exceeded',
  { skip: !parentDirectory },
  async () => {
    const result = await runCase(
      ({ res }) =>
        res.end(syntheticStream(html, 'gpt-6.1-sol', { input_tokens: 600000, output_tokens: 10 })),
      {
        policy: {
          referenceEnvelopeStopEnabled: false,
          userDecisionReference: 'synthetic-explicit-current-user-decision',
        },
      }
    );
    assert.equal(result.calls, 9);
    assert.equal(result.ledger.dispatches, 9);
    assert.equal(result.ledger.stopReason, null);
    assert.ok(result.ledger.referenceKnownUSD > 1);
    assert.equal(result.ledger.actualUSD, null);
  }
);

test('no-fee-limit live grant must explicitly bind removal and exact user decision', () => {
  const manifest = {
    executionConfig: { routeFingerprint: sha256('route') },
    budgetPolicy: {
      referenceEnvelopeStopEnabled: false,
      userDecisionReference: 'current-user-decision',
    },
  };
  const authorization = {
    approved: true,
    manifestSha256: sha256('manifest'),
    mode: 'live-participant',
    maxDispatches: 9,
    retries: 0,
    routeFingerprint: sha256('route'),
    moneyRisk: {
      explicitUserApproval: true,
      unknownActualBillingAccepted: true,
      referenceEnvelopeIsNotHardCap: true,
      noNewCreditPurchase: true,
      costLimitsRemovedByUser: true,
    },
    allowUnknownUsage: false,
    userDecisionReference: 'current-user-decision',
  };
  const validate = (auth) =>
    validateNineAuthorization({
      authorization: auth,
      manifestSha256: sha256('manifest'),
      manifest,
      mode: 'live-participant',
    });
  assert.doesNotThrow(() => validate(authorization));
  assert.throws(() =>
    validate({
      ...authorization,
      moneyRisk: { ...authorization.moneyRisk, costLimitsRemovedByUser: false },
    })
  );
  assert.throws(() => validate({ ...authorization, userDecisionReference: 'old-decision' }));
});
