import test from 'node:test';
import assert from 'node:assert/strict';
import { digest } from './history-audit.mjs';
import { bindManualReadings, assertNativeCaptureIdentity } from './history-source-bindings.mjs';

function manualFixture() {
  const object = { number: 12, body: '- [ ] Preserve both hosts and cleanup.' };
  const comments = [{ id: 24, body: 'The second host still needs a native result.' }];
  const record = {
    number: 12,
    reviewMethod: 'Read the complete body and all frozen top-level discussion.',
    bodySha256: digest(object.body),
    discussionSha256: digest(comments),
    rationale: 'Keep the original missing second-host condition.',
  };
  return { object, comments, record, discussions: new Map([[12, comments]]) };
}

test('an unchanged manual reading keeps its original record without acquiring acceptance', () => {
  const { object, record, discussions } = manualFixture();
  const bound = bindManualReadings(
    [record, { number: 99, reviewMethod: 'Deterministic inventory reconciliation' }],
    [object],
    discussions
  );
  assert.deepEqual([...bound.keys()], [12]);
  assert.equal(bound.get(12), record);
  assert.equal(bound.get(12).accepted, undefined);
});

test('a changed body cannot inherit a manual reading through the same object number', () => {
  const { object, record, discussions } = manualFixture();
  assert.throws(
    () => bindManualReadings([record], [{ ...object, body: '- [x] One host only.' }], discussions),
    /original body hash does not match/
  );
});

test('edited or newly added discussion invalidates the previous manual reading', () => {
  const { object, record, comments } = manualFixture();
  for (const changed of [
    [{ ...comments[0], body: 'A changed source condition.' }],
    [...comments, { id: 25, body: 'Also retain the cleanup evidence.' }],
  ])
    assert.throws(
      () => bindManualReadings([record], [object], new Map([[12, changed]])),
      /original discussion hash does not match/
    );
});

test('missing original proof cannot be silently replaced with a newly calculated hash', () => {
  const { object, record, discussions } = manualFixture();
  for (const field of ['bodySha256', 'discussionSha256']) {
    const unbound = { ...record };
    delete unbound[field];
    assert.throws(
      () => bindManualReadings([unbound], [object], discussions),
      /hash does not match/
    );
  }
  assert.throws(() => bindManualReadings([record], [object], new Map()), /discussion hash/);
});

test('missing source objects and duplicate manual records fail before any inheritance', () => {
  const { object, record, discussions } = manualFixture();
  assert.throws(() => bindManualReadings([record], [], discussions), /source object is absent/);
  assert.throws(
    () => bindManualReadings([record, { ...record }], [object], discussions),
    /duplicate record/
  );
});

function nativeFixture() {
  return new Map([
    ['pr-0012.json', { pullRequest: { number: 12, headRefOid: 'original-head' } }],
    ['inline-0001.json', [{ id: 24, body: 'Retain this unresolved finding.' }]],
    ['timeline-0007.json', { issue: { number: 7, timelineItems: { nodes: [] } } }],
  ]);
}

test('the same complete native source set is accepted independently of enumeration order', () => {
  const raw = nativeFixture();
  const reverse = new Map([...raw].reverse().map(([key, value]) => [key, structuredClone(value)]));
  const result = assertNativeCaptureIdentity(raw, reverse);
  assert.equal(result.captures, 3);
  assert.equal(result.sourceSetSha256, assertNativeCaptureIdentity(reverse, raw).sourceSetSha256);
});

test('an equal-sized archive for a different capture population is rejected', () => {
  const raw = nativeFixture();
  const different = new Map(raw);
  different.delete('pr-0012.json');
  different.set('pr-0013.json', { pullRequest: { number: 13 } });
  assert.throws(() => assertNativeCaptureIdentity(raw, different), /missing RAW capture/);
});

test('changed PR, inline or timeline values cannot be substituted by another archive', () => {
  const raw = nativeFixture();
  for (const name of raw.keys()) {
    const different = new Map(raw);
    different.set(name, { replaced: raw.get(name) });
    assert.throws(() => assertNativeCaptureIdentity(raw, different), /differs from RAW input/);
  }
});

test('missing or additional native captures reject the replacement before snapshot output', () => {
  const raw = nativeFixture();
  const missing = new Map(raw);
  missing.delete('inline-0001.json');
  const extra = new Map(raw);
  extra.set('pr-0013.json', { pullRequest: { number: 13 } });
  assert.throws(() => assertNativeCaptureIdentity(raw, missing), /capture set differs/);
  assert.throws(() => assertNativeCaptureIdentity(raw, extra), /capture set differs/);
});
