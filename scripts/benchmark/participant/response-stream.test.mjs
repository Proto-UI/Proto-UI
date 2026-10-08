import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeResponsesSse } from './response-stream.mjs';
const recoverCompletedItems = (raw) => {
  const decoded = decodeResponsesSse(raw);
  return {
    ...decoded,
    text: decoded.response.output
      .filter((i) => i.type === 'message')
      .flatMap((m) => m.content.map((c) => c.text))
      .join('\n'),
  };
};
const part = { type: 'output_text', text: '{"properties":[]}', annotations: [], logprobs: [] };
const response = {
  id: 'r1',
  status: 'completed',
  model: 'm1',
  error: null,
  incomplete_details: null,
  output: [],
  usage: { input_tokens: 5, output_tokens: 8 },
};
function base() {
  return [
    {
      type: 'response.created',
      response: { id: 'r1', model: 'm1', status: 'in_progress', output: [] },
    },
    { type: 'response.in_progress', response: { id: 'r1', model: 'm1', status: 'in_progress' } },
    {
      type: 'response.output_item.added',
      output_index: 0,
      item: { id: 'm1', type: 'message', role: 'assistant', status: 'in_progress', content: [] },
    },
    {
      type: 'response.content_part.added',
      output_index: 0,
      item_id: 'm1',
      content_index: 0,
      part: { type: 'output_text', text: '' },
    },
    {
      type: 'response.output_text.delta',
      output_index: 0,
      item_id: 'm1',
      content_index: 0,
      delta: part.text,
    },
    {
      type: 'response.output_text.done',
      output_index: 0,
      item_id: 'm1',
      content_index: 0,
      text: part.text,
    },
    {
      type: 'response.content_part.done',
      output_index: 0,
      item_id: 'm1',
      content_index: 0,
      part: structuredClone(part),
    },
    {
      type: 'response.output_item.done',
      output_index: 0,
      item: {
        id: 'm1',
        type: 'message',
        role: 'assistant',
        status: 'completed',
        content: [structuredClone(part)],
      },
    },
    { type: 'response.completed', response: structuredClone(response) },
  ];
}
const encoded = (events) =>
  Buffer.from(
    events
      .map((e, i) => `event: ${e.type}\ndata: ${JSON.stringify({ ...e, sequence_number: i })}\n\n`)
      .join('')
  );
test('recover exact completed item text, preserve empty primary terminal and usage', () => {
  const events = base();
  const original = structuredClone(events);
  const r = recoverCompletedItems(encoded(events));
  assert.equal(r.text, part.text);
  assert.equal(r.provenance.terminalOutputItems, 0);
  assert.equal(r.provenance.rawTerminalPreserved, true);
  assert.equal(r.provenance.integrityValidated, true);
  assert.equal(r.provenance.anomaly, 'terminal-output-empty');
  assert.deepEqual(r.terminalResponse, original.at(-1).response);
  assert.equal(r.provenance.deltasUsedOnlyForIntegrity, true);
  assert.deepEqual(r.response.usage, response.usage);
  assert.deepEqual(events, original);
});
test('CRLF comments and DONE do not change completed item content', () => {
  const bytes = Buffer.from(
    ': comment\r\n\r\n' +
      encoded(base()).toString().replaceAll('\n', '\r\n') +
      'data: [DONE]\r\n\r\n'
  );
  assert.equal(recoverCompletedItems(bytes).text, part.text);
});
const mutants = [
  ['model mismatch', (es) => (es.at(-1).response.model = 'wrong')],
  ['response ID mismatch', (es) => (es.at(-1).response.id = 'wrong')],
  ['no terminal', (es) => es.pop()],
  [
    'failed terminal',
    (es) => {
      es.at(-1).type = 'response.failed';
      es.at(-1).response.status = 'failed';
    },
  ],
  ['incomplete terminal', (es) => (es.at(-1).response.status = 'incomplete')],
  ['terminal error', (es) => (es.at(-1).response.error = { code: 'failed' })],
  ['duplicate terminal', (es) => es.push(structuredClone(es.at(-1)))],
  ['unsupported tool item', (es) => (es[2].item.type = 'function_call')],
  ['completed item refusal', (es) => (es[7].item.content[0].type = 'refusal')],
  ['completed item still in progress', (es) => (es[7].item.status = 'in_progress')],
  ['wrong role', (es) => (es[7].item.role = 'user')],
  ['added done IDs disagree', (es) => (es[7].item.id = 'wrong')],
  ['unknown text item ID', (es) => (es[5].item_id = 'wrong')],
  ['missing text done', (es) => es.splice(5, 1)],
  ['missing part done', (es) => es.splice(6, 1)],
  ['missing item done', (es) => es.splice(7, 1)],
  ['done delta disagreement', (es) => (es[4].delta = 'wrong')],
  ['done part disagreement', (es) => (es[6].part.text = 'wrong')],
  ['done item disagreement', (es) => (es[7].item.content[0].text = 'wrong')],
  ['duplicate part done', (es) => es.splice(7, 0, structuredClone(es[6]))],
  ['duplicate text done', (es) => es.splice(6, 0, structuredClone(es[5]))],
  ['duplicate item done', (es) => es.splice(8, 0, structuredClone(es[7]))],
  ['content index mismatch', (es) => (es[5].content_index = 1)],
  ['output index mismatch', (es) => (es[5].output_index = 1)],
  [
    'terminal nonempty conflict',
    (es) => (es.at(-1).response.output = [{ type: 'message', id: 'different' }]),
  ],
  ['event after terminal', (es) => es.push(structuredClone(es[1]))],
  ['no creation', (es) => es.shift()],
  ['duplicate creation', (es) => es.splice(1, 0, structuredClone(es[0]))],
  ['malformed item index', (es) => (es[2].output_index = -1)],
];
for (const [name, mutate] of mutants)
  test('reject ' + name, () => {
    const es = base();
    mutate(es);
    assert.throws(() => recoverCompletedItems(encoded(es)));
  });
test('reject sequence gaps even when semantic events intact', () => {
  const raw = encoded(base()).toString().replace('"sequence_number":4', '"sequence_number":400');
  assert.throws(() => recoverCompletedItems(Buffer.from(raw)), /sequence/);
});
test('reject malformed JSON, UTF8, oversize and incomplete framing', () => {
  for (const bytes of [
    Buffer.from('data: {bad}\n\n'),
    Buffer.from([255]),
    Buffer.alloc(4_000_001),
    encoded(base()).subarray(0, -1),
  ])
    assert.throws(() => recoverCompletedItems(bytes));
});
test('reject data after DONE and early DONE', () => {
  assert.throws(() =>
    recoverCompletedItems(
      Buffer.concat([encoded(base()), Buffer.from('data: [DONE]\n\ndata: {}\n\n')])
    )
  );
  assert.throws(() =>
    recoverCompletedItems(Buffer.concat([Buffer.from('data: [DONE]\n\n'), encoded(base())]))
  );
});

function extraPart(es, ci = 1) {
  const extra = base()
    .slice(3, 7)
    .map((e) => ({ ...structuredClone(e), content_index: ci }));
  es.splice(7, 0, ...extra);
}
for (const ci of [1, 2, 99])
  test('reject completed orphan content part ' + ci, () => {
    const es = base();
    extraPart(es, ci);
    assert.throws(() => recoverCompletedItems(encoded(es)), /inventory/);
  });
test('reject extra part after expected content but before item completion', () => {
  const es = base();
  extraPart(es);
  es.splice(8, 2);
  assert.throws(() => recoverCompletedItems(encoded(es)));
});
test('accept complete contiguous multi-part content', () => {
  const es = base();
  extraPart(es);
  es.at(-2).item.content.push(structuredClone(part));
  const r = recoverCompletedItems(encoded(es));
  assert.equal(r.text, part.text + '\n' + part.text);
});
for (const value of [undefined, '', 42, null])
  test('reject invalid equal creation and terminal model ' + String(value), () => {
    const es = base();
    for (const e of es) if (e.response) e.response.model = value;
    assert.throws(() => recoverCompletedItems(encoded(es)), /model/);
  });

test('matching nonempty terminal validates lifecycle rather than bypassing it', () => {
  const es = base();
  es.at(-1).response.output = [structuredClone(es.at(-2).item)];
  const decoded = decodeResponsesSse(encoded(es));
  assert.deepEqual(decoded.response, es.at(-1).response);
  assert.equal(decoded.provenance.anomaly, null);
  es[4].delta = 'corrupt';
  assert.throws(() => decodeResponsesSse(encoded(es)), /Delta integrity/);
});
test('multiple assistant messages preserve output order and contiguous item/part indices', () => {
  const es = base(),
    second = base().slice(2, 8);
  for (const e of second) {
    e.output_index = 1;
    if (e.item) e.item.id = 'm2';
    if (e.item_id) e.item_id = 'm2';
  }
  es.splice(8, 0, ...second);
  const decoded = recoverCompletedItems(encoded(es));
  assert.equal(decoded.text, part.text + '\n' + part.text);
  assert.equal(decoded.provenance.completedMessageCount, 2);
});
for (const [name, mutate] of [
  ['duplicate item added', (es) => es.splice(3, 0, structuredClone(es[2]))],
  ['duplicate item ID', (es) => es.splice(3, 0, { ...structuredClone(es[2]), output_index: 1 })],
  ['duplicate part added', (es) => es.splice(4, 0, structuredClone(es[3]))],
  ['delta after text done', (es) => es.splice(6, 0, structuredClone(es[4]))],
  ['content after item done', (es) => es.splice(8, 0, structuredClone(es[4]))],
  ['added wrong role', (es) => (es[2].item.role = 'user')],
  ['added nonempty content', (es) => (es[2].item.content = [part])],
  [
    'part before item added',
    (es) => {
      const p = es.splice(3, 1)[0];
      es.splice(2, 0, p);
    },
  ],
  [
    'noncontiguous item indices',
    (es) => {
      for (const e of es) if (e.output_index !== undefined) e.output_index = 1;
    },
  ],
  [
    'unsupported reasoning summary delta',
    (es) => es.splice(2, 0, { type: 'response.reasoning_summary_text.delta', delta: 'unknown' }),
  ],
  ['unsupported unknown event', (es) => es.splice(2, 0, { type: 'provider.hidden_event' })],
  ['terminal missing output', (es) => delete es.at(-1).response.output],
  [
    'terminal incomplete details',
    (es) => (es.at(-1).response.incomplete_details = { reason: 'limit' }),
  ],
  [
    'empty completed message',
    (es) => {
      es[4].delta = '';
      es[5].text = '';
      es[6].part.text = '';
      es[7].item.content[0].text = '';
    },
  ],
])
  test('strict rejection: ' + name, () => {
    const es = base();
    mutate(es);
    assert.throws(() => decodeResponsesSse(encoded(es)));
  });
for (const mode of [false, true])
  test('lifecycle never discarded, compatibility=' + mode, () => {
    const es = base();
    es[4].delta = 'corrupt';
    assert.throws(() => decodeResponsesSse(encoded(es), { allowLegacyTerminalOnly: mode }));
    const raw = Buffer.from(
      'data: {"type":"response.output_text.delta","delta":"unbound"}\n\n' +
        `data: ${JSON.stringify({ type: 'response.completed', response: response })}\n\n`
    );
    assert.throws(() => decodeResponsesSse(raw, { allowLegacyTerminalOnly: mode }), /sequence/);
  });
test('terminal-only legacy compatibility is explicit and labelled, never default', () => {
  const terminal = { ...response, output: [base().at(-2).item] };
  const raw = Buffer.from(
    `data: ${JSON.stringify({ type: 'response.completed', response: terminal })}\n\n`
  );
  assert.throws(() => decodeResponsesSse(raw));
  const decoded = decodeResponsesSse(raw, { allowLegacyTerminalOnly: true });
  assert.deepEqual(decoded.response, terminal);
  assert.equal(decoded.provenance.kind, 'explicit-legacy-terminal-only');
  assert.equal(decoded.provenance.integrityValidated, false);
  assert.equal(decoded.provenance.anomaly, 'legacy-lifecycle-unavailable');
});
for (const [name, raw] of [
  ['missing sequence', () => encoded(base()).toString().replace(',"sequence_number":4', '')],
  [
    'duplicate sequence',
    () => encoded(base()).toString().replace('"sequence_number":4', '"sequence_number":3'),
  ],
  [
    'named mismatch',
    () => encoded(base()).toString().replace('event: response.created', 'event: wrong'),
  ],
  ['duplicate DONE', () => encoded(base()).toString() + 'data: [DONE]\n\ndata: [DONE]\n\n'],
])
  test('framing/sequence rejects ' + name, () =>
    assert.throws(() => decodeResponsesSse(Buffer.from(raw())))
  );
test('original terminal is attached to validation failure, never normalized on rejection', () => {
  const es = base();
  es.at(-1).response.output = [{ id: 'bad', type: 'message' }];
  assert.throws(
    () => decodeResponsesSse(encoded(es)),
    (e) => {
      assert.deepEqual(e.terminalResponse, es.at(-1).response);
      assert.equal(e.assembly.integrityValidated, false);
      return true;
    }
  );
});
