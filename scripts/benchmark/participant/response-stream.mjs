import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const terminalStatuses = new Map([
  ['response.completed', 'completed'],
  ['response.failed', 'failed'],
  ['response.incomplete', 'incomplete'],
]);

/** Parse only at EOF. Raw bytes, original terminal, and assembly provenance are
 * separate evidence. Ported from validated completed-item recovery v2; deltas
 * are integrity witnesses, never a source for synthesized participant text.
 * Terminal-only fixtures require explicit compatibility; it cannot waive any
 * lifecycle event, sequence, content inventory, or completion check.
 */
export function decodeResponsesSse(rawBytes, { allowLegacyTerminalOnly = false } = {}) {
  let terminalResponse;
  const events = [];
  const fail = (message) => {
    throw new Error(message);
  };
  try {
    assert.ok(
      rawBytes instanceof Uint8Array && rawBytes.length <= 4_000_000,
      'Invalid SSE byte bound'
    );
    assert.equal(typeof allowLegacyTerminalOnly, 'boolean', 'Invalid legacy compatibility option');
    let raw;
    try {
      raw = new TextDecoder('utf-8', { fatal: true }).decode(rawBytes);
    } catch {
      fail('body is not valid UTF-8');
    }
    let event = '',
      data = [],
      done = false;
    const dispatch = () => {
      if (!data.length) {
        event = '';
        return;
      }
      const text = data.join('\n'),
        name = event;
      data = [];
      event = '';
      if (done) fail('event after DONE');
      if (name === 'error' || name === 'response.error') fail('protocol error');
      if (text === '[DONE]') {
        if (name) fail('event/type mismatch');
        if (!terminalResponse) fail('missing terminal response');
        done = true;
        return;
      }
      let value;
      try {
        value = JSON.parse(text);
      } catch {
        fail('data is not valid JSON');
      }
      assert.ok(
        value &&
          typeof value === 'object' &&
          !Array.isArray(value) &&
          typeof value.type === 'string' &&
          value.type,
        'invalid event object'
      );
      if (name && name !== value.type) fail('event/type mismatch');
      if (value.type === 'error' || value.type === 'response.error') fail('protocol error');
      if (terminalStatuses.has(value.type)) {
        if (terminalResponse) fail('duplicate terminal response');
        assert.ok(
          value.response && typeof value.response === 'object' && !Array.isArray(value.response),
          'invalid terminal response'
        );
        // Preserve even a semantically invalid original terminal for diagnosis.
        terminalResponse = value.response;
        if (value.response.status !== terminalStatuses.get(value.type))
          fail('status/event mismatch');
      } else if (terminalResponse) fail('event after terminal response');
      events.push(value);
    };
    const lines = raw.split(/\r\n|\n|\r/);
    if (/[\r\n]$/.test(raw)) lines.pop();
    for (const line of lines) {
      if (line === '') {
        dispatch();
        continue;
      }
      if (line.startsWith(':')) continue;
      const colon = line.indexOf(':');
      const field = colon < 0 ? line : line.slice(0, colon);
      let value = colon < 0 ? '' : line.slice(colon + 1);
      if (value.startsWith(' ')) value = value.slice(1);
      if (field === 'event') event = value;
      else if (field === 'data') data.push(value);
    }
    if (data.length || event) fail('unterminated event');
    if (!terminalResponse) fail('missing terminal response');
    if (events.length === 1 && allowLegacyTerminalOnly) {
      // An omitted sequence is the explicit legacy fixture shape. An invalid
      // supplied sequence still fails; compatibility never swallows lifecycle.
      if (events[0].sequence_number !== undefined)
        assert.equal(events[0].sequence_number, 0, 'Invalid legacy terminal sequence');
      assert.ok(Array.isArray(terminalResponse.output), 'Invalid legacy terminal output');
      return {
        response: terminalResponse,
        terminalResponse,
        provenance: {
          kind: 'explicit-legacy-terminal-only',
          integrityValidated: false,
          anomaly: 'legacy-lifecycle-unavailable',
          rawTerminalPreserved: true,
          events: 1,
          terminalOutputItems: terminalResponse.output.length,
          rawSha256: hash(rawBytes),
          formalAdmission: false,
        },
      };
    }
    const assembled = validateCompletedItems(events, terminalResponse);
    return {
      response: assembled.response,
      terminalResponse,
      provenance: {
        kind: 'strict-completed-item-assembly-v1',
        anomaly: terminalResponse.output.length === 0 ? 'terminal-output-empty' : null,
        rawTerminalPreserved: true,
        integrityValidated: true,
        terminalOutputItems: terminalResponse.output.length,
        completedItemCount: assembled.response.output.length,
        completedMessageCount: assembled.response.output.filter((i) => i.type === 'message').length,
        events: events.length,
        sequenceIntegrity: true,
        allTextDonePartDoneItemDoneAgree: true,
        deltasUsedOnlyForIntegrity: true,
        sourceOfText:
          'Exact response.output_item.done assistant message content; not synthesized from deltas',
        rawSha256: hash(rawBytes),
        textSha256: hash(assembled.text),
        formalAdmission: false,
      },
    };
  } catch (cause) {
    const error = new Error(`HTTP SSE ${cause.message}`, { cause });
    error.terminalResponse = terminalResponse;
    error.assembly = {
      kind: 'rejected-stream-assembly',
      integrityValidated: false,
      anomaly: 'integrity-validation-failed',
      rawTerminalPreserved: terminalResponse !== undefined,
      events: events.length,
      formalAdmission: false,
    };
    throw error;
  }
}

// The v2 recoverer's complete sequence/identity/index/content checks. Unknown
// event families (including tools/refusals) fail closed, also for full terminals.
function validateCompletedItems(events, terminalResponse) {
  for (let i = 0; i < events.length; i++)
    assert.equal(events[i].sequence_number, i, 'Missing/repeated/reordered sequence');
  const allowed = new Set([
    'response.created',
    'response.in_progress',
    'response.output_item.added',
    'response.output_item.done',
    'response.content_part.added',
    'response.content_part.done',
    'response.output_text.delta',
    'response.output_text.done',
    'response.completed',
  ]);
  let created = null,
    terminal = null;
  const added = new Map(),
    done = new Map(),
    parts = new Map(),
    partDone = new Map(),
    textDone = new Map(),
    deltas = new Map();
  const index = (n) => {
    assert.ok(Number.isSafeInteger(n) && n >= 0 && n < 100);
    return n;
  };
  const key = (e) => `${index(e.output_index)}:${index(e.content_index)}`;
  const boundItem = (e) => {
    const item = added.get(index(e.output_index));
    assert.ok(item, 'Unknown output item');
    assert.equal(e.item_id, item.id);
    assert.equal(item.type, 'message');
    return item;
  };
  for (const e of events) {
    assert.ok(allowed.has(e.type), `Unsupported event ${e.type}`);
    assert.ok(!terminal, 'Event after terminal');
    if (e.type === 'response.created') {
      assert.equal(created, null, 'Duplicate creation');
      assert.ok(typeof e.response.model === 'string' && e.response.model, 'Invalid model');
      assert.equal(e.response.status, 'in_progress');
      assert.ok(typeof e.response.id === 'string' && e.response.id);
      created = e.response;
      continue;
    }
    assert.ok(created, 'Event before response creation');
    if (e.type === 'response.in_progress') {
      assert.equal(e.response.id, created.id);
      assert.equal(e.response.model, created.model);
      assert.equal(e.response.status, 'in_progress');
      continue;
    }
    if (e.type === 'response.completed') {
      assert.equal(e.response.id, created.id);
      assert.equal(e.response.model, created.model);
      assert.equal(e.response.status, 'completed');
      assert.equal(e.response.error, null);
      assert.equal(e.response.incomplete_details, null);
      terminal = e.response;
      continue;
    }
    if (e.type === 'response.output_item.added') {
      const i = index(e.output_index);
      assert.ok(!added.has(i), 'Duplicate item added');
      assert.ok(['message', 'reasoning'].includes(e.item.type), 'Tools or unsupported output item');
      assert.ok(typeof e.item.id === 'string' && e.item.id);
      assert.ok(![...added.values()].some((x) => x.id === e.item.id), 'Duplicate item ID');
      if (e.item.type === 'message') {
        assert.equal(e.item.role, 'assistant');
        assert.equal(e.item.status, 'in_progress');
        assert.deepEqual(e.item.content, []);
      }
      added.set(i, e.item);
      continue;
    }
    if (e.type === 'response.output_item.done') {
      const i = index(e.output_index),
        old = added.get(i);
      assert.ok(old && !done.has(i), 'Unknown/duplicate item done');
      assert.equal(e.item.id, old.id);
      assert.equal(e.item.type, old.type);
      if (e.item.type === 'message') {
        assert.equal(e.item.status, 'completed');
        assert.equal(e.item.role, 'assistant');
        assert.ok(e.item.content.length > 0);
        for (const c of e.item.content) {
          assert.equal(c.type, 'output_text');
          assert.equal(typeof c.text, 'string');
        }
      }
      done.set(i, e.item);
      continue;
    }
    boundItem(e);
    const k = key(e);
    assert.ok(!done.has(e.output_index), 'Content after completed item');
    if (e.type === 'response.content_part.added') {
      assert.ok(!parts.has(k));
      assert.equal(e.part.type, 'output_text');
      assert.equal(e.part.text, '');
      parts.set(k, e.part);
      deltas.set(k, '');
      continue;
    }
    assert.ok(parts.has(k), 'Content before part added');
    if (e.type === 'response.output_text.delta') {
      assert.ok(!textDone.has(k), 'Delta after done');
      assert.equal(typeof e.delta, 'string');
      deltas.set(k, deltas.get(k) + e.delta);
      continue;
    }
    if (e.type === 'response.output_text.done') {
      assert.ok(!textDone.has(k));
      assert.equal(typeof e.text, 'string');
      assert.equal(e.text, deltas.get(k), 'Delta integrity mismatch');
      textDone.set(k, e.text);
      continue;
    }
    if (e.type === 'response.content_part.done') {
      assert.ok(textDone.has(k) && !partDone.has(k));
      assert.equal(e.part.type, 'output_text');
      assert.equal(e.part.text, textDone.get(k));
      partDone.set(k, e.part);
    }
  }
  assert.ok(terminal, 'No terminal completion');
  assert.equal(added.size, done.size, 'Missing completed item');
  assert.ok(done.size > 0);
  const output = [];
  const expectedKeys = [];
  for (let i = 0; i < done.size; i++) {
    const item = done.get(i);
    assert.ok(item, 'Noncontiguous item indices');
    output.push(item);
    if (item.type === 'message')
      for (let ci = 0; ci < item.content.length; ci++) {
        const k = `${i}:${ci}`;
        expectedKeys.push(k);
        assert.ok(partDone.has(k) && textDone.has(k));
        assert.deepEqual(item.content[ci], partDone.get(k), 'Completed item/part mismatch');
        assert.equal(item.content[ci].text, textDone.get(k));
      }
  }
  for (const [name, map] of [
    ['added', parts],
    ['part-done', partDone],
    ['text-done', textDone],
    ['deltas', deltas],
  ])
    assert.deepEqual(
      [...map.keys()].sort(),
      [...expectedKeys].sort(),
      `Content inventory mismatch: ${name}`
    );
  assert.ok(Array.isArray(terminal.output));
  if (terminal.output.length) assert.deepEqual(terminal.output, output, 'Terminal/item mismatch');
  const messages = output.filter((i) => i.type === 'message');
  assert.ok(messages.length > 0);
  const text = messages.flatMap((m) => m.content.map((c) => c.text)).join('\n');
  assert.ok(text.length > 0);
  assert.equal(terminal, terminalResponse);
  return { text, response: { ...terminal, output } };
}
