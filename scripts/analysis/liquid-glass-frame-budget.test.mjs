import assert from 'node:assert/strict';
import { test } from 'node:test';
import { distribution, summarizeWindow } from './liquid-glass-frame-budget.mjs';

test('empty timing is unmeasured; percentiles retain tails', () => {
  assert.equal(distribution([]), null);
  const stats = distribution([1, 1, 1, 1, 100]);
  assert.equal(stats.count, 5);
  assert.equal(stats.p50, 1);
  assert.ok(stats.p95 > 80);
  assert.equal(stats.max, 100);
});

test('a fallback or previous session is not a held-contact application', () => {
  const row = summarizeWindow({
    round: 1,
    mode: 'static-contact',
    before: { resources: { renders: 3, renderMilliseconds: 9, encodeMilliseconds: 3 } },
    after: { resources: { renders: 5, renderMilliseconds: 15, encodeMilliseconds: 5 } },
    browserBefore: {},
    browserAfter: {},
    sample: {
      start: 0,
      end: 100,
      raf: [{ timestamp: 1 }, { timestamp: 17 }],
      longtasks: [],
      states: [{ quality: 'self-optical' }],
      inputs: [{ type: 'pointerdown', time: 10, timestamp: 8, session: '1', trusted: true }],
      commits: [
        { time: 11, quality: 'opaque-fallback', contact: 'held', session: '2', frame: '4' },
        { time: 12, quality: 'self-optical', contact: 'held', session: '1', frame: '5' },
        { time: 25, quality: 'self-optical', contact: 'held', session: '2', frame: '6' },
      ],
    },
  });
  assert.equal(row.contactStartListenerToHeldCommitMs.p95, 15);
  assert.equal(row.contactStartEventTimestampToHeldCommitMs.p95, 17);
  assert.equal(row.meanRenderIncludingEncodeMs, 3);
  assert.equal(row.meanEncodeMs, 1);
  assert.equal(row.resourceDelta.readbackMilliseconds, undefined);
});

test('coalesced pointer moves retain missing inputs and distinct commit counts', () => {
  const row = summarizeWindow({
    round: 1,
    mode: 'static-contact',
    before: { resources: {} },
    after: { resources: {} },
    browserBefore: {},
    browserAfter: {},
    sample: {
      start: 0,
      end: 100,
      raf: [],
      longtasks: [],
      states: [],
      inputs: [
        { type: 'pointerdown', time: 1, timestamp: 1, session: '0', trusted: true },
        ...[10, 20, 40].map((time) => ({ type: 'pointermove', time, session: '1', trusted: true })),
      ],
      commits: [{ time: 30, quality: 'self-optical', contact: 'held', session: '1', frame: '1' }],
    },
  });
  assert.equal(row.dragInputs, 3);
  assert.equal(row.dragEventToNextHeldCommitOpportunityMs.count, 2);
  assert.equal(row.distinctHeldCommitsFollowingDrag, 1);
  assert.equal(row.dragInputsWithoutLaterHeldCommit, 1);
  assert.equal(row.rafIntervalMs, null);
  assert.equal(row.meanRenderIncludingEncodeMs, null);
});
