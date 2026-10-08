import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { executeNine } from './nine-runner.mjs';
import { inspectNineRevision, sha256 } from './nine-plan.mjs';
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
const json = (value) => JSON.stringify(value, null, 2) + '\n';
export async function rehearseNine({
  directory,
  manifestSha256,
  sourceRoot,
  evidenceRoot,
  positiveHtmlPath,
  negativeHtmlPath,
}) {
  assert.ok(path.isAbsolute(evidenceRoot));
  const { manifest } = await inspectNineRevision({ directory, manifestSha256, sourceRoot });
  await mkdir(evidenceRoot);
  const positive = await readFile(positiveHtmlPath, 'utf8');
  const negative = await readFile(negativeHtmlPath, 'utf8');
  const hostError = positive.replace(
    '</body>',
    "<script>queueMicrotask(()=>{throw new Error('Explicit synthetic rehearsal host error');});</script></body>"
  );
  assert.notEqual(hostError, positive, 'Host-error fixture injection required');
  const fixtures = [
    positive,
    negative,
    'explicit synthetic invalid deliverable',
    hostError,
    `\`\`\`html\n${positive.trim()}\n\`\`\``,
    null,
    positive,
    negative,
    positive,
  ];
  await mkdir(path.join(evidenceRoot, 'fixtures'));
  const inputs = [];
  for (const [index, text] of fixtures.entries()) {
    const raw =
      text == null
        ? Buffer.from('event: response.completed\ndata: {deliberately-broken}\n\n')
        : stream(text, index);
    const filename = `slot-${index + 1}.raw`;
    await writeFile(path.join(evidenceRoot, 'fixtures', filename), raw, { flag: 'wx' });
    inputs.push({
      slotIndex: index + 1,
      file: filename,
      sha256: sha256(raw),
      synthetic: true,
      source:
        text == null
          ? 'malformed local SSE fixture'
          : [2, 3, 4].includes(index)
            ? 'declared local mutation/wrapper'
            : 'retained author/reviewer HTML control, not participant output',
    });
  }
  await writeFile(
    path.join(evidenceRoot, 'fixture-provenance.json'),
    json({
      kind: 'offline-synthetic-only',
      participantProviderCalls: 0,
      positiveHtmlPath,
      positiveSha256: sha256(positive),
      negativeHtmlPath,
      negativeSha256: sha256(negative),
      usageSource: 'Invented small fixture counters, not model token measurements',
      inputs,
    }),
    { flag: 'wx' }
  );
  const authorization = {
    approved: true,
    manifestSha256,
    mode: 'offline-synthetic',
    maxDispatches: 9,
    retries: 0,
  };
  const executeScenario = async (name, handler, options = {}) => {
    const requests = [];
    const server = createServer(async (request, response) => {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      assert.equal(request.headers.authorization, 'Bearer LOCAL-SYNTHETIC-TEST-SECRET');
      const raw = Buffer.concat(chunks);
      requests.push(raw);
      handler(response, requests.length);
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const endpoint = `http://127.0.0.1:${server.address().port}/responses`;
    let ledger;
    try {
      ledger = await executeNine({
        directory,
        manifestSha256,
        sourceRoot,
        executionDirectory: path.join(evidenceRoot, name),
        mode: 'offline-synthetic',
        authorization,
        transportFactory: ({ archiveDir }) =>
          responsesTransport({
            endpoint,
            archiveDir,
            token: 'LOCAL-SYNTHETIC-TEST-SECRET',
            allowLoopbackHttp: true,
            requestTimeoutMs: options.timeoutMs ?? 180000,
            maxResponseBytes: 4_000_000,
          }),
      });
    } finally {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
    assert.equal(requests.length, ledger.dispatches);
    const comparisons = [];
    for (const [index, request] of requests.entries()) {
      const row = ledger.rows[index];
      const approved = await readFile(
        path.join(directory, manifest.packets[row.condition].request.path)
      );
      assert.ok(request.equals(approved), 'Synthetic server observed non-frozen bytes');
      comparisons.push({
        slot: row.id,
        bytes: request.length,
        sha256: sha256(request),
        exactFrozenWire: true,
      });
    }
    await writeFile(
      path.join(evidenceRoot, name, 'wire-observations.json'),
      json({ origin: 'offline-synthetic', comparisons }),
      { flag: 'wx' }
    );
    return ledger;
  };
  const mixed = await executeScenario('mixed-nine', async (res, index) =>
    res.end(await readFile(path.join(evidenceRoot, 'fixtures', inputs[index - 1].file)))
  );
  assert.equal(mixed.dispatches, 9);
  assert.equal(mixed.participantProviderCalls, 0);
  assert.equal(mixed.coverage.scorable, 6);
  assert.equal(mixed.coverage.allPassed, 4);
  assert.equal(mixed.coverage.notRun, 0);
  assert.equal(mixed.rows[0].allPassed, true);
  assert.equal(mixed.rows[1].scoringEligible, true);
  assert.ok(mixed.rows[1].corePassed < 15);
  assert.equal(mixed.rows[2].receivingStatus, 'invalid-deliverable');
  assert.equal(mixed.rows[3].scoringEligible, false);
  assert.equal(mixed.rows[3].corePassed, null);
  assert.equal(mixed.rows[5].receivingStatus, 'failed');
  const malformed = await readFile(
    path.join(evidenceRoot, 'mixed-nine', mixed.rows[5].id, 'http', 'response.raw'),
    'utf8'
  );
  assert.ok(malformed.includes('deliberately-broken'));
  const stopped = await executeScenario('interrupted-stop', (res, index) =>
    index === 2
      ? res.destroy()
      : res.end(stream('synthetic invalid deliverable; no browser needed', index))
  );
  assert.equal(stopped.dispatches, 2);
  assert.equal(stopped.coverage.notRun, 7);
  assert.ok(stopped.stopReason);
  const timeout = await executeScenario(
    'deadline-stop',
    (res, index) =>
      index === 2
        ? res.write('event: incomplete-synthetic\ndata: ')
        : res.end(stream('synthetic invalid deliverable; no browser needed', index)),
    { timeoutMs: 100 }
  );
  assert.equal(timeout.dispatches, 2);
  assert.equal(timeout.coverage.notRun, 7);
  assert.ok(timeout.stopReason);
  const drift = await executeScenario('identity-stop', (res, index) =>
    res.end(
      stream(
        'synthetic invalid deliverable; no browser needed',
        index,
        index === 2 ? 'synthetic-changed-model' : 'gpt-6.1-sol'
      )
    )
  );
  assert.equal(drift.dispatches, 2);
  assert.equal(drift.stopReason, 'returned-model-mismatch');
  assert.equal(drift.coverage.notRun, 7);
  const budget = await executeScenario('reference-stop', (res, index) =>
    res.end(
      stream('synthetic invalid deliverable; no browser needed', index, 'gpt-6.1-sol', {
        input_tokens: 600000,
        output_tokens: 10,
      })
    )
  );
  assert.equal(budget.dispatches, 1);
  assert.equal(budget.coverage.notRun, 8);
  assert.equal(budget.stopReason, 'reference-envelope-exhausted-not-monetary-cap');
  const files = await readdir(evidenceRoot, { recursive: true, withFileTypes: true });
  for (const entry of files.filter((f) => f.isFile())) {
    const raw = await readFile(path.join(entry.parentPath, entry.name));
    assert.equal(
      raw.includes(Buffer.from('LOCAL-SYNTHETIC-TEST-SECRET')),
      false,
      'Authentication leaked into evidence'
    );
  }
  const result = {
    kind: 'minimal-offline-e2e-rehearsal',
    synthetic: true,
    participantProviderCalls: 0,
    manifestSha256,
    mixedNine: {
      dispatches: 9,
      scorable: 6,
      allPassed: 4,
      notScorable: 3,
      semanticFailureSubmissions: 2,
    },
    stopCases: [stopped, timeout, drift, budget].map((j) => ({
      dispatches: j.dispatches,
      notRun: j.coverage.notRun,
      reason: j.stopReason,
    })),
    credentialEvidenceAbsent: true,
    scope:
      'Frozen wire -> unchanged strict HTTP/SSE receiver -> raw+terminal+assembly+receipt -> extraction -> unchanged real bounded browser oracle -> 6+9/full15 rows. Stop probes use invalid synthetic HTML to avoid redundant browser checks; 100ms is a shorter synthetic transport timeout, not a changed live budget. No real model samples or costs.',
  };
  await writeFile(path.join(evidenceRoot, 'rehearsal-result.json'), json(result), { flag: 'wx' });
  return result;
}
