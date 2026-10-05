import test from 'node:test';
import assert from 'node:assert/strict';
import { checkAnimatedRun, checkRestingFrame, rectNear } from './motion-contract.mjs';
const rect = (y) => ({ x: 20, y, width: 100, height: 40 });
const frame = (actual = rect(100), target = rect(100)) => ({
  actual,
  target,
  scrollY: 0,
  expectedCurrent: '#one',
  current: ['#one'],
  highlightCount: 1,
  highlightId: 1,
  highlight: { ariaHidden: 'true', pointerEvents: 'none', visibility: 'visible', opacity: '1' },
  surfaceCount: 1,
  surface: {
    defined: true,
    tag: 'wc-site-shadcn-surface',
    visibility: 'visible',
    display: 'block',
    opacity: '1',
    backgroundColor: 'rgb(230, 230, 230)',
    styleTokens: 'rounded-md border-0 bg-muted text-foreground',
  },
});
test('resting checks reject absent/decorative geometry and wrong ownership', () => {
  assert.deepEqual(checkRestingFrame(frame()), []);
  assert.ok(checkRestingFrame({ ...frame(), highlightCount: 0 }).length);
  assert.ok(checkRestingFrame({ ...frame(), surface: { defined: false, tag: 'div' } }).length);
  assert.ok(checkRestingFrame(frame(rect(20))).length);
  assert.equal(rectNear(null, rect(0)), false);
});
test('static before/after states cannot pass animated motion evidence', () => {
  assert.ok(
    checkAnimatedRun([frame(rect(0), rect(0)), frame(rect(100), rect(100))]).failures.length
  );
});
test('multiple intermediate frames prove interpolation but replacements still fail', () => {
  const samples = [frame(rect(0), rect(0)), frame(rect(20)), frame(rect(70)), frame()];
  assert.deepEqual(checkAnimatedRun(samples).failures, []);
  samples[2].highlightId = 2;
  assert.ok(checkAnimatedRun(samples).failures.some((message) => message.includes('replaced')));
});

test('native current is checked against independent linked-heading geometry', () => {
  assert.ok(
    checkRestingFrame({ ...frame(), current: ['#wrong'] }).some((value) =>
      value.includes('reading boundary')
    )
  );
});

test('geometry without visible paint cannot pass', () => {
  assert.ok(
    checkRestingFrame({ ...frame(), highlight: { ...frame().highlight, visibility: 'hidden' } })
      .length
  );
  assert.ok(
    checkRestingFrame({
      ...frame(),
      surface: { ...frame().surface, backgroundColor: 'rgba(0, 0, 0, 0)' },
    }).length
  );
});

test('layout invalidation lag cannot impersonate CSS interpolation', () => {
  const samples = [
    frame(rect(0), rect(0)),
    frame(rect(20), rect(100)),
    frame(rect(70), rect(100)),
    frame(),
  ];
  for (const sample of samples) sample.inlineTarget = sample.actual;
  assert.ok(checkAnimatedRun(samples).failures.some((value) => value.includes('interpolation')));
});

import { classifyFrameSamples } from './motion-contract.mjs';
const epochFrame = (sampledInputEpoch, inputEpoch, current = ['#right']) => ({
  sampledInputEpoch,
  inputEpoch,
  connected: true,
  current,
  expectedCurrent: '#right',
  t: 1,
});
test('isolates an old-frame timer by input epoch without discarding its diagnostic', () => {
  const stale = epochFrame(0, 1, ['#old']);
  const result = classifyFrameSamples([stale, epochFrame(1, 1)], 1);
  assert.deepEqual(result.beforeFrame, [stale]);
  assert.equal(result.postFrame.length, 1);
  assert.deepEqual(result.failures, []);
});
test('same-epoch wrong current still fails even if a later sample is correct', () => {
  assert.ok(
    classifyFrameSamples([epochFrame(1, 1, ['#old']), epochFrame(1, 1)], 1).failures.length
  );
});
test('isolating every sample or omitting the final input epoch cannot pass', () => {
  assert.ok(classifyFrameSamples([epochFrame(0, 1)], 1).failures.length);
  assert.ok(classifyFrameSamples([epochFrame(0, 0)], 1).failures.length);
});
