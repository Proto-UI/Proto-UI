import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import https from 'node:https';
import { EventEmitter } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { responsesTransport } from './http-transport.mjs';
import { exchange, participantText } from './no-tools.mjs';

const root = await mkdtemp(path.join(os.tmpdir(), 'bounded-http-'));
const completed = {
  status: 'completed',
  output: [
    { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'synthetic' }] },
  ],
};
async function attempt(handler, options = {}, body = { fixture: true }) {
  let calls = 0;
  const server = createServer((req, res) => {
    calls++;
    handler(req, res);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const archiveDir = path.join(root, `attempt-${Math.random()}`);
  const transport = responsesTransport({
    endpoint: `http://127.0.0.1:${server.address().port}/responses`,
    token: 'TEST-CREDENTIAL-NOT-ARCHIVED',
    archiveDir,
    allowLoopbackHttp: true,
    // Older loopback fixtures intentionally have no lifecycle. Normal default is strict.
    allowLegacyTerminalOnly: true,
    requestTimeoutMs: 1000,
    ...options,
  });
  let response, error;
  try {
    response = await transport(body, new AbortController().signal);
  } catch (e) {
    error = e.message;
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  const metadata = JSON.parse(await readFile(path.join(archiveDir, 'transport.json')));
  const raw = await readFile(path.join(archiveDir, 'response.raw'));
  for (const file of metadata.files) {
    const bytes = await readFile(path.join(archiveDir, file.name));
    assert.equal(bytes.length, file.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256);
  }
  assert.ok(!JSON.stringify(metadata).includes('TEST-CREDENTIAL'));
  assert.ok(
    !(await readFile(path.join(archiveDir, 'request.json'), 'utf8')).includes('TEST-CREDENTIAL')
  );
  assert.equal(calls, 1);
  assert.equal(transport.evidence().status, 'complete');
  console.log(JSON.stringify({ archiveDir, outcome: metadata.outcome, error }));
  return { response, error, metadata, raw, transport };
}
test('HTTP validation: disallow implicit insecure routes, credentials in URL and redirects', () => {
  const opts = { token: 'secret', archiveDir: path.join(root, 'not-created') };
  for (const endpoint of [
    'http://127.0.0.1/r',
    'http://example.com/r',
    'https://u:p@example.com/r',
    'https://example.com/r?key=x',
    'file:///tmp/x',
  ])
    assert.throws(() => responsesTransport({ ...opts, endpoint }));
});
test('successful raw response, authenticated request, hash replay and single-use', async () => {
  const raw = JSON.stringify(completed);
  const r = await attempt((req, res) => {
    assert.equal(req.headers.authorization, 'Bearer TEST-CREDENTIAL-NOT-ARCHIVED');
    res.end(raw);
  });
  assert.deepEqual(r.response, completed);
  assert.equal(r.raw.toString(), raw);
  assert.equal(r.metadata.rawBodyComplete, true);
  await assert.rejects(r.transport({}, new AbortController().signal), /single-use/);
});
for (const [name, status, text, error] of [
  ['malformed', 200, '{invalid', /UTF-8 JSON/],
  ['invalid encoding', 200, Buffer.from([0xff]), /UTF-8 JSON/],
  ['server failure', 503, 'failure original', /non-success/],
  ['redirect', 307, 'redirect original', /redirect/],
])
  test(`retain ${name} without retry`, async () => {
    const r = await attempt((_req, res) => {
      res.writeHead(status, { Location: 'http://127.0.0.1:1/leak' });
      res.end(text);
    });
    assert.match(r.error, error);
    assert.equal(r.raw.toString('hex'), Buffer.from(text).toString('hex'));
    assert.equal(r.metadata.rawBodyComplete, true);
  });
test('response limit retains prefix, not a complete body', async () => {
  const r = await attempt((_req, res) => res.end('x'.repeat(1000)), { maxResponseBytes: 17 });
  assert.match(r.error, /byte bound/);
  assert.equal(r.raw.length, 17);
  assert.equal(r.metadata.rawBodyComplete, false);
  assert.equal(r.metadata.responseBytesObserved > 17, true);
});
test('hard HTTP deadline retains partial body', async () => {
  const r = await attempt((_req, res) => res.write('partial'), { requestTimeoutMs: 70 });
  assert.match(r.error, /deadline/);
  assert.equal(r.raw.toString(), 'partial');
  assert.equal(r.metadata.rawBodyComplete, false);
});
test('explicit abort retains partial response without retry', async () => {
  const server = createServer((_req, res) => res.write('partial-abort'));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const archiveDir = path.join(root, 'abort');
  const transport = responsesTransport({
    endpoint: `http://127.0.0.1:${server.address().port}/r`,
    token: '',
    archiveDir,
    allowLoopbackHttp: true,
  });
  const controller = new AbortController();
  const pending = transport({}, controller.signal);
  const timer = setTimeout(() => controller.abort(), 100);
  try {
    await assert.rejects(pending, /aborted/);
  } finally {
    clearTimeout(timer);
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  assert.equal((await readFile(path.join(archiveDir, 'response.raw'))).toString(), 'partial-abort');
});
test('refusal is raw-complete but not a valid participant deliverable', async () => {
  const refusal = {
    status: 'completed',
    output: [
      { type: 'message', role: 'assistant', content: [{ type: 'refusal', refusal: 'not now' }] },
    ],
  };
  const r = await attempt((_req, res) => res.end(JSON.stringify(refusal)));
  const result = await exchange({
    packet: { prompt: 'test', materials: [] },
    model: 'synthetic',
    maxOutputTokens: 100,
    wallMs: 1000,
    transport: async () => r.response,
  });
  assert.equal(result.receipt.outcome, 'failed');
  assert.deepEqual(result.receipt.response, refusal);
  assert.equal(r.metadata.outcome, 'response-received');
});
test('exchange binds a real local HTTP archive without inventing a model snapshot', async () => {
  const server = createServer((_req, res) => res.end(JSON.stringify(completed)));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const archiveDir = path.join(root, 'exchange');
  const transport = responsesTransport({
    endpoint: `http://127.0.0.1:${server.address().port}/r`,
    token: '',
    archiveDir,
    allowLoopbackHttp: true,
  });
  try {
    const result = await exchange({
      packet: { prompt: 'test', materials: [] },
      model: 'synthetic',
      maxOutputTokens: 100,
      wallMs: 1000,
      transport,
    });
    assert.equal(result.receipt.outcome, 'completed');
    assert.equal(result.receipt.text, 'synthetic');
    assert.equal(result.receipt.modelSnapshot, null);
    assert.deepEqual(result.receipt.transportEvidence, { archiveDir, status: 'complete' });
    const request = JSON.parse(await readFile(path.join(archiveDir, 'request.json')));
    assert.deepEqual(request, result.request);
    const reused = responsesTransport({
      endpoint: `http://127.0.0.1:${server.address().port}/r`,
      token: '',
      archiveDir,
      allowLoopbackHttp: true,
    });
    await assert.rejects(reused({}, new AbortController().signal), /EEXIST/);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

const sse = (type, response, newline = '\n') =>
  `event: ${type}${newline}data: ${JSON.stringify({ type, response })}${newline}${newline}`;
const terminalSse = sse('response.completed', completed);
async function streamAttempt(raw, options = {}) {
  return attempt(
    (_req, res) => {
      res.setHeader('Content-Type', 'text/event-stream');
      res.end(raw);
    },
    options,
    { stream: true }
  );
}
function assertCompleteStream(r, raw) {
  assert.equal(r.raw.toString('hex'), Buffer.from(raw).toString('hex'));
  assert.equal(r.metadata.rawBodyComplete, true);
  assert.equal(r.metadata.rawBodyBytes, Buffer.byteLength(raw));
}
for (const newline of ['\n', '\r\n'])
  test(`SSE explicit legacy terminal-only decoding supports ${JSON.stringify(newline)}, comments, multiline data and DONE`, async () => {
    const raw = [
      ': keepalive',
      'id: 1',
      'retry: 100',
      '',
      'event: response.completed',
      'data: {"type":"response.completed",',
      `data: "response":${JSON.stringify(completed)}}`,
      '',
      'data: [DONE]',
      '',
      '',
    ].join(newline);
    const r = await streamAttempt(raw);
    assert.equal(r.error, undefined);
    assert.deepEqual(r.response, completed);
    assert.equal(r.metadata.outcome, 'response-received');
    assertCompleteStream(r, raw);
  });
test('SSE accepts unnamed events by JSON type without requiring DONE', async () => {
  const raw = `data: ${JSON.stringify({ type: 'response.completed', response: completed })}\n\n`;
  const r = await streamAttempt(raw);
  assert.equal(r.error, undefined);
  assert.deepEqual(r.response, completed);
  assertCompleteStream(r, raw);
});
test('SSE chunked UTF-8 preserves exact terminal text and full raw bytes', async () => {
  const response = structuredClone(completed);
  response.output[0].content[0].text = '中文 🧪 café';
  const raw = Buffer.from(sse('response.completed', response, '\r\n') + 'data: [DONE]\r\n\r\n');
  const r = await attempt(
    (_req, res) => {
      res.setHeader('Content-Type', 'text/event-stream');
      void (async () => {
        // Deliberately cross UTF-8 codepoints and CRLF framing in separate HTTP writes.
        for (const byte of raw) {
          if (res.destroyed) return;
          res.write(Buffer.from([byte]));
          await delay(1);
        }
        res.end();
      })();
    },
    { requestTimeoutMs: 3000, allowLegacyTerminalOnly: true },
    { stream: true }
  );
  assert.equal(r.error, undefined);
  assert.deepEqual(r.response, response);
  assertCompleteStream(r, raw);
});
for (const status of ['failed', 'incomplete'])
  test(`SSE response.${status} returns the original non-success response, not synthesized completion`, async () => {
    const response = {
      status,
      output: [],
      ...(status === 'failed'
        ? { error: { code: 'fixture_failure', message: 'fixture only' } }
        : { incomplete_details: { reason: 'max_output_tokens' } }),
    };
    const raw = sse(`response.${status}`, response);
    const r = await streamAttempt(raw);
    assert.equal(r.error, undefined);
    assert.deepEqual(r.response, response);
    assert.throws(() => participantText(r.response), /Provider status/);
    assertCompleteStream(r, raw);
  });
for (const [name, raw, error] of [
  ['malformed JSON', 'event: response.completed\ndata: {bad}\n\n', /SSE.*JSON/],
  ['malformed delta after terminal', terminalSse + 'data: {bad}\n\n', /SSE.*JSON/],
  ['invalid UTF-8', Buffer.concat([Buffer.from(terminalSse), Buffer.from([0xff])]), /UTF-8/],
  ['malformed delta before terminal', 'data: {bad}\n\n' + terminalSse, /SSE.*JSON/],
  [
    'unbound lifecycle delta before terminal (also with legacy opt-in)',
    'data: {"type":"response.output_text.delta","delta":"unbound"}\n\n' + terminalSse,
    /SSE.*sequence/,
  ],
  [
    'missing terminal with only delta',
    'data: {"type":"response.output_text.delta","delta":"partial"}\n\n',
    /SSE.*missing terminal/,
  ],
  ['missing terminal with DONE', 'data: [DONE]\n\n', /SSE.*missing terminal/],
  ['empty stream', ': comment only\n\n', /SSE.*missing terminal/],
  ['duplicate terminal', terminalSse + terminalSse, /SSE.*duplicate terminal/],
  [
    'conflicting terminal',
    terminalSse + sse('response.failed', { status: 'failed' }),
    /SSE.*duplicate terminal/,
  ],
  [
    'event/type mismatch',
    `event: response.failed\ndata: ${JSON.stringify({ type: 'response.completed', response: completed })}\n\n`,
    /SSE.*event\/type mismatch/,
  ],
  [
    'terminal/status mismatch',
    sse('response.completed', { ...completed, status: 'incomplete' }),
    /SSE.*status\/event mismatch/,
  ],
  ['failed/status mismatch', sse('response.failed', completed), /SSE.*status\/event mismatch/],
  [
    'incomplete/status mismatch',
    sse('response.incomplete', completed),
    /SSE.*status\/event mismatch/,
  ],
  [
    'missing terminal response',
    'data: {"type":"response.completed"}\n\n',
    /SSE.*terminal response/,
  ],
  ['non-object terminal response', sse('response.completed', []), /SSE.*terminal response/],
  ['missing status', sse('response.completed', { output: [] }), /SSE.*status\/event mismatch/],
  ['null event', 'data: null\n\n', /SSE.*event object/],
  ['array event', 'data: []\n\n', /SSE.*event object/],
  ['missing type', 'data: {}\n\n', /SSE.*event object/],
  [
    'protocol error',
    'event: error\ndata: {"type":"error","message":"fixture error"}\n\n',
    /SSE.*protocol error/,
  ],
  [
    'response protocol error',
    'data: {"type":"response.error","error":{"message":"fixture error"}}\n\n',
    /SSE.*protocol error/,
  ],
  [
    'protocol error after terminal',
    terminalSse + 'data: {"type":"error"}\n\n',
    /SSE.*protocol error/,
  ],
  ['event after DONE', terminalSse + 'data: [DONE]\n\n' + terminalSse, /SSE.*after DONE/],
  ['duplicate DONE', terminalSse + 'data: [DONE]\n\ndata: [DONE]\n\n', /SSE.*after DONE/],
  [
    'delta after terminal',
    terminalSse + 'data: {"type":"response.output_text.delta","delta":"late"}\n\n',
    /SSE.*after terminal/,
  ],
  [
    'named protocol error with DONE',
    terminalSse + 'event: error\ndata: [DONE]\n\n',
    /SSE.*protocol error/,
  ],
  [
    'mislabeled DONE',
    terminalSse + 'event: response.completed\ndata: [DONE]\n\n',
    /SSE.*event\/type mismatch/,
  ],
  ['unterminated terminal', terminalSse.trimEnd(), /SSE.*unterminated/],
  ['terminal with only one newline', terminalSse.slice(0, -1), /SSE.*unterminated/],
])
  test(`SSE rejects ${name} while retaining full raw evidence`, async () => {
    const r = await streamAttempt(raw);
    assert.match(r.error ?? '', error);
    assert.equal(r.response, undefined);
    assert.equal(r.metadata.outcome, 'failed');
    assertCompleteStream(r, raw);
  });
test('SSE byte bound includes deltas and bytes after terminal, retaining only bounded prefix', async () => {
  const raw = terminalSse + ': ' + 'x'.repeat(1000) + '\n\n';
  const maxResponseBytes = Buffer.byteLength(terminalSse) + 17;
  const r = await streamAttempt(raw, { maxResponseBytes });
  assert.match(r.error, /byte bound/);
  assert.equal(r.response, undefined);
  assert.equal(r.metadata.rawBodyComplete, false);
  assert.equal(r.metadata.rawBodyBytes, maxResponseBytes);
  assert.deepEqual(r.raw, Buffer.from(raw).subarray(0, maxResponseBytes));
  assert.ok(r.metadata.responseBytesObserved > maxResponseBytes);
});
for (const [name, raw] of [
  ['partial frame', 'event: response.completed\ndata: {'],
  ['terminal before EOF', terminalSse],
])
  test(`SSE total deadline rejects ${name} without early success`, async () => {
    const r = await attempt(
      (_req, res) => {
        res.setHeader('Content-Type', 'text/event-stream');
        res.write(raw);
      },
      { requestTimeoutMs: 70 },
      { stream: true }
    );
    assert.match(r.error, /deadline/);
    assert.equal(r.response, undefined);
    assert.equal(r.metadata.rawBodyComplete, false);
    assert.equal(r.raw.toString(), raw);
  });
test('SSE does not reset the total deadline on keepalive traffic', async () => {
  const r = await attempt(
    (_req, res) => {
      res.write(': initial\n\n');
      const timer = setInterval(() => res.write(': keepalive\n\n'), 10);
      res.on('close', () => clearInterval(timer));
    },
    { requestTimeoutMs: 70 },
    { stream: true }
  );
  assert.match(r.error, /deadline/);
  assert.equal(r.metadata.rawBodyComplete, false);
  assert.match(r.raw.toString(), /^: initial\n\n(?:: keepalive\n\n)+$/);
});
test('SSE explicit abort retains terminal bytes without early success', async () => {
  const controller = new AbortController();
  const raw = terminalSse;
  const server = createServer((_req, res) => {
    res.write(raw);
    // Abort after the client has had time to retain the raw data.
    void delay(30).then(() => controller.abort());
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const archiveDir = path.join(root, 'sse-abort');
  const transport = responsesTransport({
    endpoint: `http://127.0.0.1:${server.address().port}/r`,
    token: '',
    archiveDir,
    allowLoopbackHttp: true,
  });
  try {
    await assert.rejects(transport({ stream: true }, controller.signal), /aborted/);
    const metadata = JSON.parse(await readFile(path.join(archiveDir, 'transport.json')));
    assert.equal(metadata.rawBodyComplete, false);
    assert.equal((await readFile(path.join(archiveDir, 'response.raw'))).toString(), raw);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
for (const [status, error] of [
  [307, /redirect/],
  [503, /non-success/],
])
  test(`SSE mode retains HTTP ${status} without decoding, redirect or retry`, async () => {
    const raw = 'fixture error, not SSE';
    const r = await attempt(
      (_req, res) => {
        res.writeHead(status, { Location: 'http://127.0.0.1:1/leak' });
        res.end(raw);
      },
      {},
      { stream: true }
    );
    assert.match(r.error, error);
    assertCompleteStream(r, raw);
  });
for (const stream of [false, 'true', 1])
  test(`SSE decoding requires stream === true, preserves JSON for ${JSON.stringify(stream)}`, async () => {
    const raw = JSON.stringify(completed);
    const r = await attempt((_req, res) => res.end(raw), {}, { stream });
    assert.deepEqual(r.response, completed);
    assert.equal(r.error, undefined);
  });
test('SSE mode does not silently accept a JSON response', async () => {
  const r = await streamAttempt(JSON.stringify(completed));
  assert.match(r.error ?? '', /SSE.*missing terminal/);
  assert.equal(r.response, undefined);
});

// No sockets/DNS/auth file reads. These tests exercise the NORMAL transport and
// its exclusive archives by replacing only the HTTP request source with bytes.
async function offlineAttempt(
  t,
  raw,
  {
    status = 200,
    keepOpen = false,
    keepalive = false,
    requestError = false,
    chunks,
    controller = new AbortController(),
    body = { stream: true },
    ...options
  } = {}
) {
  let calls = 0;
  t.mock.method(https, 'request', (_url, _opts, callback) => {
    calls++;
    const request = new EventEmitter();
    request.destroy = () => {};
    request.end = () =>
      queueMicrotask(() => {
        if (requestError) {
          request.emit('error', new Error('synthetic connection failure'));
          return;
        }
        const res = new EventEmitter();
        res.statusCode = status;
        res.destroyed = false;
        res.destroy = () => {
          res.destroyed = true;
          res.emit('close');
        };
        callback(res);
        for (const chunk of chunks ?? [Buffer.from(raw)]) {
          if (res.destroyed) break;
          res.emit('data', chunk);
        }
        if (keepalive && !res.destroyed) {
          const timer = setInterval(() => res.emit('data', Buffer.from(': keepalive\n\n')), 5);
          res.once('close', () => clearInterval(timer));
        }
        if (!keepOpen && !res.destroyed) res.emit('end');
      });
    return request;
  });
  const archiveDir = path.join(root, `offline-${Math.random()}`);
  const transport = responsesTransport({
    endpoint: 'https://offline.invalid/responses',
    token: 'OFFLINE-SYNTHETIC-NOT-AUTH',
    archiveDir,
    requestTimeoutMs: 1000,
    ...options,
  });
  let response, error;
  try {
    response = await transport(body, controller.signal);
  } catch (e) {
    error = e.message;
  }
  const metadata = JSON.parse(await readFile(path.join(archiveDir, 'transport.json')));
  for (const file of metadata.files) {
    const bytes = await readFile(path.join(archiveDir, file.name));
    assert.equal(bytes.length, file.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256);
  }
  assert.equal(calls, 1);
  assert.equal(transport.evidence().status, 'complete');
  assert.ok(!JSON.stringify(metadata).includes('OFFLINE-SYNTHETIC'));
  const archived = await readFile(path.join(archiveDir, 'response.raw'));
  return { response, error, metadata, raw: archived, transport, archiveDir };
}
function lifecycleEvents() {
  const part = { type: 'output_text', text: '中文 🧪 café', annotations: [], logprobs: [] };
  const terminal = {
    id: 'r1',
    model: 'm1',
    status: 'completed',
    error: null,
    incomplete_details: null,
    usage: { input_tokens: 4, output_tokens: 5 },
    output: [],
  };
  const bound = { item_id: 'm1', output_index: 0, content_index: 0 };
  return [
    {
      type: 'response.created',
      response: { id: 'r1', model: 'm1', status: 'in_progress', output: [] },
    },
    {
      type: 'response.output_item.added',
      output_index: 0,
      item: { id: 'm1', type: 'message', role: 'assistant', status: 'in_progress', content: [] },
    },
    { type: 'response.content_part.added', ...bound, part: { ...part, text: '' } },
    { type: 'response.output_text.delta', ...bound, delta: part.text },
    { type: 'response.output_text.done', ...bound, text: part.text },
    { type: 'response.content_part.done', ...bound, part },
    {
      type: 'response.output_item.done',
      output_index: 0,
      item: { id: 'm1', type: 'message', role: 'assistant', status: 'completed', content: [part] },
    },
    { type: 'response.completed', response: terminal },
  ];
}
const lifecycleRaw = (es) =>
  Buffer.from(
    es
      .map((e, i) => `event: ${e.type}\ndata: ${JSON.stringify({ ...e, sequence_number: i })}\n\n`)
      .join('')
  );
test('offline receiver: strict completed-item assembly preserves raw terminal, usage, text and provenance', async (t) => {
  const es = lifecycleEvents(),
    raw = lifecycleRaw(es);
  const r = await offlineAttempt(t, raw);
  assert.equal(r.error, undefined);
  assert.equal(participantText(r.response), '中文 🧪 café');
  assert.deepEqual(r.response.usage, es.at(-1).response.usage);
  assert.deepEqual(r.raw, raw);
  assert.equal(r.metadata.rawBodyComplete, true);
  assert.equal(r.metadata.assembly.anomaly, 'terminal-output-empty');
  assert.equal(r.metadata.assembly.integrityValidated, true);
  assert.equal(r.metadata.assembly.deltasUsedOnlyForIntegrity, true);
  assert.equal(r.metadata.assembly.formalAdmission, false);
  assert.deepEqual(
    JSON.parse(await readFile(path.join(r.archiveDir, 'response.terminal.json'))),
    es.at(-1).response
  );
  assert.deepEqual(
    JSON.parse(await readFile(path.join(r.archiveDir, 'response.assembled.json'))),
    r.response
  );
  assert.deepEqual(
    JSON.parse(await readFile(path.join(r.archiveDir, 'response.assembly.json'))),
    r.metadata.assembly
  );
  await assert.rejects(r.transport({ stream: true }, new AbortController().signal), /single-use/);
});
test('offline receiver: nonempty matching terminal still validates all lifecycle evidence', async (t) => {
  const es = lifecycleEvents();
  es.at(-1).response.output = [structuredClone(es.at(-2).item)];
  const r = await offlineAttempt(t, lifecycleRaw(es));
  assert.equal(r.error, undefined);
  assert.deepEqual(r.response, es.at(-1).response);
  assert.equal(r.metadata.assembly.anomaly, null);
  assert.equal(r.metadata.assembly.integrityValidated, true);
});
test('offline receiver: arbitrarily bisected UTF8 and CRLF decode only after EOF', async (t) => {
  const raw = Buffer.from(lifecycleRaw(lifecycleEvents()).toString().replaceAll('\n', '\r\n'));
  const r = await offlineAttempt(t, raw, { chunks: [...raw].map((b) => Buffer.from([b])) });
  assert.equal(r.error, undefined);
  assert.equal(participantText(r.response), '中文 🧪 café');
  assert.deepEqual(r.raw, raw);
});
for (const [name, mutate] of [
  ['delta disagreement', (es) => (es[3].delta = 'corrupt')],
  ['completed item disagreement', (es) => (es[6].item.content[0].text = 'corrupt')],
  ['missing text completion', (es) => es.splice(4, 1)],
  ['orphan part', (es) => (es[4].content_index = 1)],
  [
    'terminal nonempty conflict',
    (es) => (es.at(-1).response.output = [{ type: 'message', id: 'different' }]),
  ],
  ['model identity mismatch', (es) => (es.at(-1).response.model = 'other')],
  ['tool output', (es) => (es[1].item.type = 'function_call')],
  ['unsupported lifecycle', (es) => es.splice(2, 0, { type: 'unknown.lifecycle' })],
])
  test(
    'offline receiver rejects ' + name + ' with complete raw archive and no assembled response',
    async (t) => {
      const es = lifecycleEvents();
      mutate(es);
      const raw = lifecycleRaw(es);
      const r = await offlineAttempt(t, raw);
      assert.match(r.error, /HTTP SSE/);
      assert.equal(r.response, undefined);
      assert.equal(r.metadata.outcome, 'failed');
      assert.equal(r.metadata.assembly.integrityValidated, false);
      assert.deepEqual(r.raw, raw);
      assert.equal(r.metadata.rawBodyComplete, true);
      assert.deepEqual(
        JSON.parse(await readFile(path.join(r.archiveDir, 'response.terminal.json'))),
        es.at(-1).response
      );
      assert.ok(!r.metadata.files.some((f) => f.name === 'response.assembled.json'));
    }
  );
for (const status of ['failed', 'incomplete'])
  test('offline receiver never repairs ' + status + ' terminal into completion', async (t) => {
    const es = lifecycleEvents();
    es.at(-1).type = 'response.' + status;
    es.at(-1).response.status = status;
    const r = await offlineAttempt(t, lifecycleRaw(es));
    assert.match(r.error, /HTTP SSE/);
    assert.equal(r.response, undefined);
    assert.equal(r.metadata.outcome, 'failed');
    assert.equal(
      JSON.parse(await readFile(path.join(r.archiveDir, 'response.terminal.json'))).status,
      status
    );
  });
test('offline receiver: terminal-only normal default rejects, explicit legacy is marked and does not waive malformed lifecycle', async (t) => {
  const raw = Buffer.from(terminalSse);
  const strict = await offlineAttempt(t, raw);
  assert.match(strict.error, /HTTP SSE/);
  assert.equal(strict.response, undefined);
  const legacy = await offlineAttempt(t, raw, { allowLegacyTerminalOnly: true });
  assert.equal(legacy.error, undefined);
  assert.deepEqual(legacy.response, completed);
  assert.equal(legacy.metadata.assembly.kind, 'explicit-legacy-terminal-only');
  assert.equal(legacy.metadata.assembly.integrityValidated, false);
  const unbound = Buffer.from(
    'data: {"type":"response.output_text.delta","delta":"unbound"}\n\n' + terminalSse
  );
  const rejected = await offlineAttempt(t, unbound, { allowLegacyTerminalOnly: true });
  assert.match(rejected.error, /HTTP SSE/);
  assert.equal(rejected.response, undefined);
});
for (const [name, suffix] of [
  ['duplicate terminal', Buffer.from(terminalSse)],
  ['trailing protocol error', Buffer.from('data: {"type":"error"}\n\n')],
  ['duplicate DONE', Buffer.from('data: [DONE]\n\ndata: [DONE]\n\n')],
  ['bad UTF8', Buffer.from([255])],
])
  test(
    'offline receiver rejects ' + name + ' after completed items, retaining full raw body',
    async (t) => {
      const raw = Buffer.concat([lifecycleRaw(lifecycleEvents()), suffix]);
      const r = await offlineAttempt(t, raw);
      assert.match(r.error, /HTTP SSE/);
      assert.equal(r.response, undefined);
      assert.deepEqual(r.raw, raw);
      assert.equal(r.metadata.rawBodyComplete, true);
    }
  );
test('offline receiver: byte bound retains prefix and never validates a truncated stream', async (t) => {
  const raw = lifecycleRaw(lifecycleEvents());
  const maxResponseBytes = raw.length - 1;
  const r = await offlineAttempt(t, raw, { maxResponseBytes });
  assert.match(r.error, /byte bound/);
  assert.equal(r.response, undefined);
  assert.equal(r.metadata.rawBodyComplete, false);
  assert.deepEqual(r.raw, raw.subarray(0, maxResponseBytes));
  assert.equal(r.metadata.responseBytesObserved, raw.length);
  assert.equal(r.metadata.assembly, undefined);
});
test('offline receiver: terminal before EOF cannot defeat total deadline', async (t) => {
  const raw = lifecycleRaw(lifecycleEvents());
  const r = await offlineAttempt(t, raw, { keepOpen: true, requestTimeoutMs: 40 });
  assert.match(r.error, /deadline/);
  assert.equal(r.response, undefined);
  assert.equal(r.metadata.rawBodyComplete, false);
  assert.deepEqual(r.raw, raw);
});
test('offline receiver: explicit abort retains full available bytes without early success', async (t) => {
  const raw = lifecycleRaw(lifecycleEvents()),
    controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 40);
  try {
    const r = await offlineAttempt(t, raw, { keepOpen: true, controller });
    assert.match(r.error, /aborted/);
    assert.equal(r.response, undefined);
    assert.equal(r.metadata.rawBodyComplete, false);
    assert.deepEqual(r.raw, raw);
  } finally {
    clearTimeout(timer);
  }
});
for (const status of [307, 503])
  test(
    'offline receiver: HTTP ' + status + ' retains raw, no redirect/retry or decoder admission',
    async (t) => {
      const raw = lifecycleRaw(lifecycleEvents());
      const r = await offlineAttempt(t, raw, { status });
      assert.match(r.error, status === 307 ? /redirect/ : /non-success/);
      assert.equal(r.response, undefined);
      assert.deepEqual(r.raw, raw);
      assert.equal(r.metadata.assembly, undefined);
    }
  );
test('offline receiver: nonstream JSON behavior is unchanged', async (t) => {
  const raw = Buffer.from(JSON.stringify(completed));
  const r = await offlineAttempt(t, raw, { body: { stream: false } });
  assert.equal(r.error, undefined);
  assert.deepEqual(r.response, completed);
  assert.deepEqual(r.raw, raw);
  assert.equal(r.metadata.assembly, undefined);
});

test('offline receiver: trailing bytes after terminal count against bound', async (t) => {
  const prefix = lifecycleRaw(lifecycleEvents());
  const raw = Buffer.concat([prefix, Buffer.from(': ' + 'x'.repeat(100) + '\n\n')]);
  const r = await offlineAttempt(t, raw, { maxResponseBytes: prefix.length + 17 });
  assert.match(r.error, /byte bound/);
  assert.equal(r.response, undefined);
  assert.deepEqual(r.raw, raw.subarray(0, prefix.length + 17));
  assert.equal(r.metadata.rawBodyComplete, false);
});
test('offline receiver: keepalive traffic cannot reset total deadline', async (t) => {
  const raw = lifecycleRaw(lifecycleEvents());
  const r = await offlineAttempt(t, raw, { keepOpen: true, keepalive: true, requestTimeoutMs: 50 });
  assert.match(r.error, /deadline/);
  assert.equal(r.response, undefined);
  assert.equal(r.metadata.rawBodyComplete, false);
  assert.deepEqual(r.raw.subarray(0, raw.length), raw);
  assert.match(r.raw.subarray(raw.length).toString(), /^(?:: keepalive\n\n)+$/);
});
test('offline receiver: request failure is single-attempt and archives available evidence', async (t) => {
  const r = await offlineAttempt(t, Buffer.alloc(0), { requestError: true });
  assert.match(r.error, /request failed/);
  assert.equal(r.response, undefined);
  assert.equal(r.metadata.outcome, 'failed');
  assert.equal(r.metadata.rawBodyComplete, false);
  assert.equal(r.raw.length, 0);
});
test('offline receiver: exclusive archive reuse fails before any new dispatch', async (t) => {
  const raw = lifecycleRaw(lifecycleEvents());
  const r = await offlineAttempt(t, raw);
  let calls = 0;
  t.mock.method(https, 'request', () => {
    calls++;
    throw new Error('must not dispatch');
  });
  const reused = responsesTransport({
    endpoint: 'https://offline.invalid/responses',
    token: 'SYNTHETIC',
    archiveDir: r.archiveDir,
  });
  await assert.rejects(reused({ stream: true }, new AbortController().signal), /EEXIST/);
  assert.equal(calls, 0);
  assert.deepEqual(await readFile(path.join(r.archiveDir, 'response.raw')), raw);
});
for (const status of ['failed', 'incomplete'])
  test(
    'offline receiver: explicit terminal-only legacy ' + status + ' retains failure unchanged',
    async (t) => {
      const response = {
        status,
        output: [],
        ...(status === 'failed'
          ? { error: { code: 'fixture' } }
          : { incomplete_details: { reason: 'limit' } }),
      };
      const r = await offlineAttempt(t, Buffer.from(sse('response.' + status, response)), {
        allowLegacyTerminalOnly: true,
      });
      assert.equal(r.error, undefined);
      assert.deepEqual(r.response, response);
      assert.throws(() => participantText(r.response), /Provider status/);
      assert.equal(r.metadata.assembly.kind, 'explicit-legacy-terminal-only');
      assert.equal(r.metadata.assembly.integrityValidated, false);
    }
  );
for (const [name, raw] of [
  ['truncated frame', () => lifecycleRaw(lifecycleEvents()).subarray(0, -1)],
  [
    'sequence gap',
    () =>
      Buffer.from(
        lifecycleRaw(lifecycleEvents())
          .toString()
          .replace('"sequence_number":3', '"sequence_number":99')
      ),
  ],
  ['nonstream JSON in stream mode', () => Buffer.from(JSON.stringify(completed))],
])
  test('offline receiver rejects ' + name + ' without discarding raw', async (t) => {
    const bytes = raw();
    const r = await offlineAttempt(t, bytes);
    assert.match(r.error, /HTTP SSE/);
    assert.equal(r.response, undefined);
    assert.deepEqual(r.raw, bytes);
    assert.equal(r.metadata.rawBodyComplete, true);
  });
