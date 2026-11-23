import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertNumberFieldImeTrace,
  formatEvidenceError,
  runNumberFieldImeOwners,
} from '../number-field-ime-evidence.mjs';

test('nested aggregation retains the original editing and both owner failure stacks', () => {
  const editing = new Error('localized grouping and decimal parse');
  const uncontrolled = new Error('composition updates only the draft');
  const controlled = new Error('commit reports the accepted owner value, including refusal');
  const failure = new AggregateError(
    [editing, new AggregateError([uncontrolled, controlled], 'IME owner cases failed')],
    'Number Field editing and IME failed'
  );
  const formatted = formatEvidenceError(failure);
  for (const original of [editing, uncontrolled, controlled])
    assert.ok(formatted.includes(original.stack));
  assert.match(formatted, /Number Field editing and IME failed/);
  assert.match(formatted, /IME owner cases failed/);
  assert.equal(formatEvidenceError(null), 'null');
});

// These are explicit unit-test records, not browser evidence. The browser
// runner collects its control independently and never loads this fixture.
const nativeTrace = (endTrusted = false) => {
  const event = (type, extra = {}) => ({
    type,
    isTrusted: true,
    composed: true,
    isComposing: null,
    data: '1234,5',
    inputType: null,
    value: '1234,5',
    selectionStart: 6,
    selectionEnd: 6,
    ...extra,
  });
  return [
    event('compositionstart', { data: '20,5', value: '20,5', selectionStart: 0, selectionEnd: 4 }),
    event('compositionupdate'),
    event('beforeinput', { isComposing: true, inputType: 'insertCompositionText' }),
    event('input', { isComposing: true, inputType: 'insertCompositionText' }),
    event('compositionend', { isTrusted: endTrusted }),
  ];
};

test('the complete native trace retains and compares the observed end-event trust bit', () => {
  const baseline = assertNumberFieldImeTrace(nativeTrace(false));
  assert.equal(
    baseline.every((event) => event.isTrusted),
    false
  );
  assert.equal(baseline.at(-1).isTrusted, false);
  assert.deepEqual(assertNumberFieldImeTrace(nativeTrace(false), baseline), baseline);
  assert.throws(
    () => assertNumberFieldImeTrace(nativeTrace(true), baseline),
    /end-event trust bit/
  );
  assert.throws(
    () =>
      assertNumberFieldImeTrace(nativeTrace(false), assertNumberFieldImeTrace(nativeTrace(true))),
    /end-event trust bit/
  );
});

test('a dispatchEvent-only forgery cannot exploit an untrusted native end event', () => {
  const forged = nativeTrace(false).map((event) => ({ ...event, isTrusted: false }));
  assert.throws(() => assertNumberFieldImeTrace(forged, nativeTrace(false)), /must be trusted/);
});

for (const type of ['compositionstart', 'compositionupdate', 'beforeinput', 'input'])
  test(`an untrusted ${type} is rejected independently of the control`, () => {
    const broken = nativeTrace();
    broken.find((event) => event.type === type).isTrusted = false;
    assert.throws(() => assertNumberFieldImeTrace(broken), /must be trusted/);
  });

test('incomplete, empty, duplicate and non-editing sequences do not prove composition', () => {
  assert.throws(() => assertNumberFieldImeTrace([]), /events observed/);
  assert.throws(() => assertNumberFieldImeTrace(nativeTrace().slice(0, -1)), /completes the trace/);
  assert.throws(() => assertNumberFieldImeTrace(nativeTrace().slice(1)), /starts the trace/);
  const duplicate = nativeTrace();
  duplicate.splice(2, 0, duplicate[0]);
  assert.throws(() => assertNumberFieldImeTrace(duplicate), /one native compositionstart/);
  const extraEnd = nativeTrace();
  extraEnd.push(extraEnd.at(-1));
  assert.throws(() => assertNumberFieldImeTrace(extraEnd), /one native compositionend/);
  for (const type of ['compositionupdate', 'beforeinput', 'input'])
    assert.throws(
      () => assertNumberFieldImeTrace(nativeTrace().filter((event) => event.type !== type)),
      /observed between composition boundaries/
    );
});

test('native values, input type, selection, order and composing facts remain discriminating', () => {
  const baseline = assertNumberFieldImeTrace(nativeTrace());
  for (const [field, value] of [
    ['value', '20,5'],
    ['data', '12345'],
    ['inputType', 'insertText'],
    ['selectionStart', 0],
    ['selectionEnd', 0],
    ['composed', false],
  ]) {
    const broken = nativeTrace();
    broken[3][field] = value;
    assert.throws(() => assertNumberFieldImeTrace(broken, baseline), /independent HTML input/);
  }
  const reordered = nativeTrace();
  [reordered[1], reordered[2]] = [reordered[2], reordered[1]];
  assert.throws(() => assertNumberFieldImeTrace(reordered, baseline), /independent HTML input/);
  const notComposing = nativeTrace();
  notComposing[3].isComposing = false;
  assert.throws(() => assertNumberFieldImeTrace(notComposing, baseline), /native composing input/);
});

test('each owner records its result and is persisted before the next owner starts', async () => {
  const evidence = { cases: [] };
  const order = [];
  await runNumberFieldImeOwners(
    evidence,
    async (controlled, result) => {
      order.push(`run:${controlled}`);
      result.componentEvents.push({ type: 'valueCommit', value: controlled ? 20.5 : 1234.5 });
    },
    async (result) => order.push(`record:${result.controlled}:${result.status}`)
  );
  assert.deepEqual(order, ['run:false', 'record:false:passed', 'run:true', 'record:true:passed']);
  assert.deepEqual(
    evidence.cases.map(({ controlled, status }) => ({ controlled, status })),
    [
      { controlled: false, status: 'passed' },
      { controlled: true, status: 'passed' },
    ]
  );
});

test('the original first-owner failure is retained while controlled still reaches its terminal result', async () => {
  const evidence = { cases: [] };
  const original = new Error('trusted native events');
  await assert.rejects(
    runNumberFieldImeOwners(evidence, async (controlled, result) => {
      result.nativeEvents = nativeTrace();
      if (!controlled) throw original;
      result.componentEvents.push({ type: 'valueCommit', value: 20.5 });
    }),
    (error) => error instanceof AggregateError && error.errors[0] === original
  );
  assert.deepEqual(
    evidence.cases.map((result) => result.status),
    ['failed', 'passed']
  );
  assert.match(evidence.cases[0].error, /trusted native events/);
  assert.equal(evidence.cases[1].componentEvents[0].value, 20.5);
});

test('setup and terminal-write failures cannot leave a running record or skip the other owner', async () => {
  const evidence = { cases: [] };
  const setup = new Error('mount failed');
  const recording = new Error('disk full');
  const visited = [];
  await assert.rejects(
    runNumberFieldImeOwners(
      evidence,
      async (controlled) => {
        visited.push(controlled);
        if (!controlled) throw setup;
      },
      async (result) => {
        if (!result.controlled) throw recording;
      }
    ),
    (error) =>
      error instanceof AggregateError && error.errors[0] === setup && error.errors[1] === recording
  );
  assert.deepEqual(visited, [false, true]);
  assert.deepEqual(
    evidence.cases.map((result) => result.status),
    ['failed', 'passed']
  );
  assert.match(evidence.cases[0].error, /mount failed/);
  assert.match(evidence.cases[0].terminalWriteError, /disk full/);
});

test('failure aggregation contains both real failures rather than the first exception only', async () => {
  const evidence = { cases: [] };
  const failures = [new Error('uncontrolled failed'), new Error('controlled failed')];
  await assert.rejects(
    runNumberFieldImeOwners(evidence, async (controlled) => {
      throw failures[Number(controlled)];
    }),
    (error) =>
      error instanceof AggregateError &&
      error.errors.length === 2 &&
      error.errors.every((item, index) => item === failures[index])
  );
  assert.deepEqual(
    evidence.cases.map((result) => result.status),
    ['failed', 'failed']
  );
});
