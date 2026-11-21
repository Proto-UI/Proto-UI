import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import {
  assertCandidatePublicCaptures,
  assertCandidateScopedThemeCaptures,
  assertStableSource,
  comparisonRevisions,
  distribution,
  freshPressStages,
  isFreshPressCommit,
  summarizeFreshPressLatency,
  summarizeWindow,
} from './liquid-glass-frame-budget.mjs';

test('matched comparisons require exact explicit revisions and retain the historical default', () => {
  assert.deepEqual(comparisonRevisions({}), {
    baseline: '543c8a2990239dec7c08458a902da3f5a97b49dd',
    candidate: undefined,
  });
  assert.deepEqual(
    comparisonRevisions({ BASELINE_SHA: 'a'.repeat(40), CANDIDATE_SHA: 'b'.repeat(40) }),
    {
      baseline: 'a'.repeat(40),
      candidate: 'b'.repeat(40),
    }
  );
  for (const value of ['', 'main', '84dde63', 'g'.repeat(40)])
    assert.throws(() => comparisonRevisions({ BASELINE_SHA: value }), /exact commit/);
  assert.throws(() => comparisonRevisions({ CANDIDATE_SHA: 'HEAD' }), /exact commit/);
});

test('a mid-run source edit or new material helper invalidates the observation', () => {
  const before = { sha: 'a', tree: 'b', diffSha256: 'c', hashes: { 'program.ts': 'd' } };
  assert.doesNotThrow(() => assertStableSource(before, structuredClone(before)));
  assert.throws(() => assertStableSource(before, { ...before, sha: 'new-head' }), /HEAD changed/);
  assert.throws(
    () => assertStableSource(before, { ...before, diffSha256: 'new-patch' }),
    /patch changed/
  );
  assert.throws(
    () => assertStableSource(before, { ...before, hashes: { 'program.ts': 'changed' } }),
    /Measured source changed/
  );
  assert.throws(
    () =>
      assertStableSource(before, { ...before, hashes: { ...before.hashes, 'helper.ts': 'new' } }),
    /Measured source changed/
  );
});

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

function publicCaptures() {
  return ['public-light', 'public-dark', 'public-small'].map((name) => ({
    name,
    paints: [
      // Non-button material hosts cannot satisfy the component criterion.
      {
        quality: 'self-optical',
        committed: true,
        host: {
          role: 'tablist',
          text: 'Web Components',
          dataset: { projectionPrototype: 'liquid-glass-tabs-list' },
        },
      },
      ...['Back', 'Continue', 'Unavailable'].map((text) => ({
        quality: text === 'Unavailable' ? 'opaque-fallback' : 'self-optical',
        committed: text !== 'Unavailable',
        carrier: text === 'Unavailable' ? null : 'contact-v1',
        imageSha256:
          text === 'Unavailable'
            ? createHash('sha256').update('none').digest('hex')
            : 'rendered-paint',
        imageCharacters: text === 'Unavailable' ? 4 : 32,
        source: 'visible-app-canvas',
        geometryMatches: true,
        host: {
          text,
          role: 'button',
          disabled: false,
          ariaDisabled: text === 'Unavailable' ? 'true' : 'false',
          dataset: {
            projectionPrototype: 'liquid-glass-button',
            materialReason: text === 'Unavailable' ? 'no-active-material-candidate' : 'rendered',
          },
        },
      })),
    ],
  }));
}

test('Back optical alone cannot pass candidate public acceptance', () => {
  const captures = publicCaptures();
  const prominent = captures[2].paints.find((entry) => entry.host.text === 'Continue');
  prominent.quality = 'opaque-fallback';
  prominent.committed = false;
  prominent.carrier = null;
  prominent.host.dataset.materialReason = 'source-overlapping-content';
  assert.throws(
    () => assertCandidatePublicCaptures(captures),
    /public-small: Continue must be self-optical/
  );
});

test('both owned optical buttons and explicit disabled fallback pass all public views', () => {
  const captures = publicCaptures();
  assert.doesNotThrow(() => assertCandidatePublicCaptures(captures));
  captures[0].paints.find((entry) => entry.host.text === 'Unavailable').host.ariaDisabled = 'false';
  assert.throws(
    () => assertCandidatePublicCaptures(captures),
    /Unavailable must expose disabled semantics/
  );
});

test('disabled committed=false does not excuse a residual carrier', () => {
  const captures = publicCaptures();
  const disabled = captures[1].paints.find((entry) => entry.host.text === 'Unavailable');
  disabled.carrier = 'contact-v1';
  disabled.geometryMatches = false;
  assert.equal(disabled.committed, false);
  assert.throws(
    () => assertCandidatePublicCaptures(captures),
    /public-dark: disabled fallback retained a carrier/
  );
});

test('disabled committed=false does not excuse a non-none background image', () => {
  const captures = publicCaptures();
  const disabled = captures[2].paints.find((entry) => entry.host.text === 'Unavailable');
  const staleImage = 'url("stale-paint.png")';
  disabled.imageSha256 = createHash('sha256').update(staleImage).digest('hex');
  disabled.imageCharacters = staleImage.length;
  assert.equal(disabled.carrier, null);
  assert.equal(disabled.committed, false);
  assert.throws(
    () => assertCandidatePublicCaptures(captures),
    /public-small: disabled fallback retained a background image/
  );
});

test('scene-local theme checks real pixels against the opposite global theme', () => {
  const captures = ['light', 'dark'].map((pageTheme) => {
    const localTheme = pageTheme === 'light' ? 'dark' : 'light';
    const before = { pageTheme, width: 512, height: 240, pngSha256: `${pageTheme}-pixels` };
    return {
      pageTheme,
      localTheme,
      before,
      overridden: { ...before, pngSha256: `${localTheme}-pixels` },
      restored: { ...before },
    };
  });
  assert.doesNotThrow(() => assertCandidateScopedThemeCaptures(captures));
  const unchanged = structuredClone(captures);
  unchanged[0].overridden = unchanged[0].before;
  assert.throws(() => assertCandidateScopedThemeCaptures(unchanged), /did not repaint/);
  const onlyDatasetChanged = structuredClone(captures);
  onlyDatasetChanged[0].overridden.pngSha256 = 'unrelated-pixels';
  assert.throws(() => assertCandidateScopedThemeCaptures(onlyDatasetChanged), /pixels differ/);
  const notRestored = structuredClone(captures);
  notRestored[0].restored.pngSha256 = 'dark-pixels';
  assert.throws(() => assertCandidateScopedThemeCaptures(notRestored), /did not restore/);
});

function freshTrial() {
  const down = {
    time: 2,
    timestamp: 1,
    frame: '10',
    pointerId: 1,
    trusted: true,
    buttons: 1,
    phaseBin: '0',
  };
  const up = { time: 100, timestamp: 99, pointerId: 1, trusted: true, buttons: 0 };
  return {
    mode: 'static',
    attempted: true,
    priorSession: 1,
    expectedSession: 2,
    downCount: 1,
    upCount: 1,
    down,
    up,
    inputs: [down, up],
    states: [{ quality: 'self-optical' }],
    deadline: 2002,
    outcomes: { held: 'resolved', release: 'resolved' },
    held: {
      time: 5,
      frame: '11',
      session: '2',
      quality: 'self-optical',
      contact: 'held',
      paint: {
        committed: true,
        carrier: 'contact-v1',
        source: 'visible-app-canvas',
        geometryMatches: true,
        quality: 'self-optical',
      },
    },
  };
}

test('repeated presses accept only their exact session and new owned frame', () => {
  const trial = freshTrial();
  const serialized = Function(`return (${isFreshPressCommit.toString()})`)();
  assert.equal(serialized(trial, trial.held), true);
  assert.equal(
    isFreshPressCommit(trial, { ...trial.held, session: '3' }),
    false,
    'A later session cannot fill a missing earlier press'
  );
  assert.equal(
    isFreshPressCommit(trial, { ...trial.held, frame: '10' }),
    false,
    'An old frame is not a response'
  );
  assert.equal(
    isFreshPressCommit(trial, { ...trial.held, paint: { ...trial.held.paint, committed: false } }),
    false
  );
  assert.equal(isFreshPressCommit({ ...trial, priorSession: '' }, trial.held), false);
});

test('fresh press commit must precede release, next down and the fixed deadline', () => {
  const trial = freshTrial();
  assert.equal(isFreshPressCommit({ ...trial, up: { ...trial.up, time: 5 } }, trial.held), false);
  assert.equal(isFreshPressCommit({ ...trial, nextDownTime: 5 }, trial.held), false);
  assert.equal(isFreshPressCommit({ ...trial, deadline: 5 }, trial.held), false);
  assert.equal(isFreshPressCommit(trial, { ...trial.held, time: 1 }), false);
});

test('fresh press summary retains slow, missing and unattempted denominators', () => {
  const slow = freshTrial();
  slow.held.time = 17;
  const missing = freshTrial();
  missing.held = null;
  missing.outcomes.held = 'timeout';
  const summary = summarizeFreshPressLatency({
    workload: { plannedPerMode: 60 },
    samples: [slow, missing],
  });
  assert.equal(summary.static.planned, 60);
  assert.equal(summary.static.attempted, 2);
  assert.equal(summary.static.resolved, 1);
  assert.equal(summary.static.unresolvedAttempted, 1);
  assert.equal(summary.static.notAttempted, 58);
  assert.equal(summary.static.listenerToHeldCommitMs.p95, 15);
  assert.equal(
    summary.static.listenerOver10Ms,
    1,
    'Slow samples remain resolved, not filtered or retried'
  );
  assert.equal(summary.dynamic.notAttempted, 60);
});

test('press stages retain pre-handler delay and distinct source-work intervals', () => {
  const trial = freshTrial();
  trial.down.timestamp = 1;
  trial.down.time = 21;
  trial.held.time = 26;
  trial.resourcesBefore = { sourcePreparations: 2, renders: 3 };
  trial.down.resources = { sourcePreparations: 3, renders: 4 };
  trial.held.resources = { sourcePreparations: 3, renders: 5 };
  const stages = freshPressStages(trial);
  assert.equal(stages.eventTimestampToListenerMs, 20);
  assert.equal(stages.listenerToHeldCommitMs, 5);
  assert.equal(stages.armedToListenerResources.sourcePreparations, 1);
  assert.equal(stages.listenerToHeldResources.sourcePreparations, 0);
  const summary = summarizeFreshPressLatency({
    workload: { plannedPerMode: 60 },
    samples: [trial],
  });
  assert.equal(summary.static.eventTimestampToListenerMs.p95, 20);
  assert.equal(summary.static.eventTimestampToHeldCommitMs.p95, 25);
  assert.equal(summary.static.listenerToHeldCommitMs.p95, 5);
  assert.equal(summary.static.armedToListenerSourcePreparationTrials, 1);
  assert.equal(summary.static.listenerToHeldSourcePreparationTrials, 0);
  assert.equal(freshPressStages({}).armedToListenerResources, null);
  assert.equal(freshPressStages({}).eventTimestampToListenerMs, null);
});
