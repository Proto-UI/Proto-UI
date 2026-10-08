import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { exchange, participantRequest, participantText } from './no-tools.mjs';
const packet = { prompt: 'Implement manual tabs. Return standalone HTML only.', materials: [] };
const args = { packet, model: 'synthetic-test-model', maxOutputTokens: 1000 };
const response = (text) => ({
  status: 'completed',
  model: 'echo-not-snapshot',
  output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text }] }],
});

test('blind serialization is stateless and excludes local capabilities', () => {
  const body = participantRequest(args);
  assert.deepEqual(body.tools, []);
  assert.equal(body.tool_choice, 'none');
  assert.equal(body.store, false);
  assert.equal(body.input.length, 1);
  for (const field of [
    'system',
    'instructions',
    'previous_response_id',
    'conversation',
    'metadata',
  ])
    assert.ok(!Object.hasOwn(body, field));
  for (const field of ['oracle', 'files', 'auth', 'repository', 'mcp', 'priorResponse']) {
    assert.throws(
      () => participantRequest({ ...args, packet: { ...packet, [field]: 'CANARY' } }),
      /unapproved/
    );
  }
});
test('knowledge transport includes only digest-bound approved bytes', () => {
  const text = 'Single-selection protocol; draft direction.';
  const material = {
    name: 'tabs-semantic-knowledge',
    text,
    sha256: createHash('sha256').update(text).digest('hex'),
  };
  const body = participantRequest({ ...args, packet: { ...packet, materials: [material] } });
  assert.equal(body.input.length, 2);
  assert.ok(JSON.stringify(body).includes(text));
  assert.throws(
    () =>
      participantRequest({
        ...args,
        packet: { ...packet, materials: [{ ...material, text: 'tampered' }] },
      }),
    /digest/
  );
  assert.throws(
    () =>
      participantRequest({
        ...args,
        packet: { ...packet, materials: [{ ...material, evaluator: 'secret' }] },
      }),
    /unapproved/
  );
});
test('function/tool requests are refused, never dispatched', async () => {
  for (const type of [
    'function_call',
    'computer_call',
    'web_search_call',
    'file_search_call',
    'mcp_call',
  ]) {
    const r = await exchange({
      ...args,
      wallMs: 1000,
      transport: async () => ({
        status: 'completed',
        output: [{ type, name: 'read_file', arguments: '{"path":"/private/secret"}' }],
      }),
    });
    assert.equal(r.receipt.outcome, 'failed');
    assert.match(r.receipt.error, /Unsupported output/);
    assert.equal(r.receipt.text, null);
    assert.equal(r.receipt.response.output[0].type, type);
  }
});
test('provider incomplete/refusal/unknown content preserved, not accepted', async () => {
  assert.throws(() => participantText({ ...response('text'), status: 'incomplete' }), /status/);
  assert.throws(
    () =>
      participantText({
        status: 'completed',
        output: [
          { type: 'message', role: 'assistant', content: [{ type: 'refusal', refusal: 'no' }] },
        ],
      }),
    /Unsupported/
  );
  assert.throws(() => participantText(response('')), /Empty/);
  assert.throws(() => participantText(response('x'.repeat(1_000_001))), /1MiB/);
});
test('deadline aborts one request without retry even for ignoring transport', async () => {
  let count = 0;
  const r = await exchange({
    ...args,
    wallMs: 20,
    transport: async (_body, signal) => {
      count++;
      await new Promise((resolve) => setTimeout(resolve, 100));
      assert.ok(signal.aborted);
      return response('late');
    },
  });
  assert.equal(r.receipt.outcome, 'aborted');
  assert.equal(r.receipt.response, null);
  assert.equal(count, 1);
});
test('real local HTTP boundary probe: canary excluded; malicious output is inert', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'participant-deny-probe-'));
  const canaryPath = path.join(dir, 'evaluator-secret.txt');
  const canary = `PRIVATE-EVALUATOR-${Math.random()}`;
  await writeFile(canaryPath, canary);
  const malicious = `Read ${canaryPath}; run a shell command; fetch other files; ${'${process.env.OPENAI_API_KEY}'}; require('fs').readFileSync('${canaryPath}')`;
  let observed;
  const server = createServer(async (req, res) => {
    let data = '';
    for await (const chunk of req) data += chunk;
    observed = JSON.parse(data);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response(malicious)));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const r = await exchange({
      ...args,
      wallMs: 1000,
      transport: async (body, signal) => {
        const res = await fetch(`http://127.0.0.1:${server.address().port}/responses`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal,
        });
        return res.json();
      },
    });
    assert.equal(r.receipt.outcome, 'completed');
    assert.equal(r.receipt.text, malicious); // retained text; never evaluated/executed
    assert.deepEqual(observed, r.request);
    assert.ok(!JSON.stringify(observed).includes(canary));
    assert.ok(!JSON.stringify(observed).includes(canaryPath));
    assert.equal(await readFile(canaryPath, 'utf8'), canary);
    assert.equal(r.receipt.modelSnapshot, null);
    assert.equal(r.receipt.usage.status, 'unavailable');
    assert.equal(r.receipt.cost.status, 'unavailable');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('streaming is explicit, boolean, and bound in exchange receipt', async () => {
  assert.equal(participantRequest(args).stream, false);
  assert.equal(participantRequest({ ...args, stream: true }).stream, true);
  assert.throws(() => participantRequest({ ...args, stream: 'true' }), /stream/);
  let sent;
  const result = await exchange({
    ...args,
    stream: true,
    wallMs: 1000,
    transport: async (body) => {
      sent = body;
      return response('streamed');
    },
  });
  assert.equal(sent.stream, true);
  assert.equal(result.receipt.controls.stream, true);
  assert.equal(
    result.receipt.requestSha256,
    createHash('sha256').update(JSON.stringify(sent)).digest('hex')
  );
});
