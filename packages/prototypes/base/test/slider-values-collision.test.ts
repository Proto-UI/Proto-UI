import { expect, it } from 'vitest';
import { resolveValuesCollision } from '../src/slider/values-collision';
import { constrainValuesRequest } from '../src/slider/values-numeric';

const policy = { min: 0, max: 100, step: 1, minStepsBetweenValues: 10 };
const run = (
  behavior: 'push' | 'swap' | 'none',
  values: readonly number[],
  index: number,
  next: number,
  start = values,
  p = policy
) =>
  resolveValuesCollision({
    behavior,
    values,
    sessionStart: start,
    index,
    nextValue: next,
    policy: p,
  });
const ok = (values: number[], index: number, didSwap = false) => ({
  ok: true,
  values,
  index,
  didSwap,
});

it('push uses latest accepted proposal and pullback does not restore pushed neighbors', () => {
  expect(run('push', [20, 40, 60], 0, 45)).toEqual(ok([45, 55, 65], 0));
  expect(run('push', [45, 55, 65], 0, 25, [20, 40, 60])).toEqual(ok([25, 55, 65], 0));
});
it('push reserves enough space at both endpoints and propagates both directions', () => {
  expect(run('push', [20, 40, 60], 0, 100)).toEqual(ok([80, 90, 100], 0));
  expect(run('push', [20, 40, 60], 2, 0)).toEqual(ok([0, 10, 20], 2));
  expect(run('push', [20, 40, 60], 1, 50)).toEqual(ok([20, 50, 60], 1));
});
it('none stops at adjacent gap and changes no other slot', () => {
  expect(run('none', [20, 40, 60], 0, 45)).toEqual(ok([30, 40, 60], 0));
  expect(run('none', [20, 40, 60], 2, 0)).toEqual(ok([20, 40, 50], 2));
});
it('none does not replace the existing keyboard same-slot rejection policy', () => {
  expect(constrainValuesRequest([20, 40, 60], 0, 45, policy)).toEqual({
    ok: false,
    reason: 'minimum-distance',
  });
  expect(run('none', [20, 40, 60], 0, 45)).toEqual(ok([30, 40, 60], 0));
});
it('swap crosses at most one neighbor even when a sample traverses multiple values', () => {
  expect(run('swap', [20, 40, 60], 0, 80)).toEqual(ok([30, 80, 90], 1, true));
  expect(run('swap', [20, 40, 60], 2, 0)).toEqual(ok([0, 10, 50], 1, true));
});
it('swap restoration uses the start vector, unlike latest-proposal push', () => {
  const current = [30, 80, 90],
    start = [20, 40, 60];
  expect(run('swap', current, 1, 20, start)).toEqual(ok([20, 40, 60], 0, true));
  expect(run('swap', current, 1, 20, current)).toEqual(ok([20, 40, 90], 0, true));
});
it('swap uses exact crossing rather than upstream epsilon equivalence', () => {
  expect(run('swap', [20, 40, 60], 0, 40 - 1e-8)).toEqual(ok([30, 40, 60], 0));
  expect(run('swap', [20, 40, 60], 0, 40)).toEqual(ok([30, 40, 60], 1, true));
});
it('equal selected request does not migrate across duplicate values', () => {
  expect(
    run('swap', [40, 40, 60], 0, 40, [40, 40, 60], { ...policy, minStepsBetweenValues: 0 })
  ).toEqual(ok([40, 40, 60], 0));
});
for (const behavior of ['push', 'swap', 'none'] as const) {
  it(`${behavior} returns a detached scalar-slot result and preserves immutable input`, () => {
    const input = Object.freeze([20]);
    expect(run(behavior, input, 0, 105)).toEqual(ok([100], 0));
    expect(input).toEqual([20]);
  });
  it(`${behavior} rejects an empty vector and invalid selection`, () => {
    for (const index of [-1, 3, 0.5, NaN, Infinity])
      expect(run(behavior, [20, 40, 60], index, 30)).toEqual({
        ok: false,
        reason: 'invalid-index',
      });
    expect(run(behavior, [], 0, 30)).toEqual({ ok: false, reason: 'invalid-index' });
  });
  it(`${behavior} rejects mismatched history and unordered current/history`, () => {
    expect(run(behavior, [20, 40], 0, 30, [20])).toEqual({
      ok: false,
      reason: 'invalid-session-start',
    });
    expect(run(behavior, [40, 20], 0, 30)).toEqual({ ok: false, reason: 'unordered-values' });
    expect(run(behavior, [20, 40], 0, 30, [40, 20])).toEqual({
      ok: false,
      reason: 'unordered-values',
    });
  });
  it(`${behavior} rejects nonfinite requests, impossible spacing and nonfinite intermediates`, () => {
    expect(run(behavior, [20, 40], 0, Infinity)).toEqual({
      ok: false,
      reason: 'nonfinite-request',
    });
    expect(run(behavior, [20, 40, 60], 0, 30, [20, 40, 60], { ...policy, max: 15 })).toEqual({
      ok: false,
      reason: 'insufficient-range',
    });
    expect(
      run(behavior, [-1e308, 1e308], 0, 0, [-1e308, 1e308], { ...policy, min: -1e308, max: 1e308 })
    ).toEqual({ ok: false, reason: 'nonfinite-intermediate' });
  });
}
it('rejects unknown modes instead of silently choosing none', () => {
  expect(run('invalid' as any, [20, 40], 0, 30)).toEqual({
    ok: false,
    reason: 'invalid-collision-behavior',
  });
});
it('does not invoke ordinary index getters or caller iterators', () => {
  let reads = 0;
  const values = [20, 40];
  Object.defineProperty(values, '0', {
    get() {
      reads++;
      return 20;
    },
  });
  expect(run('push', values, 0, 30)).toEqual({ ok: false, reason: 'invalid-value-shape' });
  expect(reads).toBe(0);
});
it('retains fractional intent identity without fixed-decimal quantization', () => {
  expect(run('none', [0.123456789012345], 0, 0.123456789012346)).toEqual(
    ok([0.123456789012346], 0)
  );
});
it('diagnoses representational gap failure rather than applying an epsilon', () => {
  const p = { min: 0, max: 1, step: 0.1, minStepsBetweenValues: 1 };
  expect(run('none', [0.4, 0.6], 1, 0.5, [0.4, 0.6], p)).toEqual({
    ok: false,
    reason: 'minimum-distance',
  });
});
it('repairs invalid incoming owner bounds through push but does not silently repair none', () => {
  expect(run('push', [-20, 40, 120], 1, 50)).toEqual(ok([0, 50, 100], 1));
  expect(run('none', [-20, 40, 120], 1, 50)).toEqual({ ok: false, reason: 'invalid-bounds' });
  expect(run('swap', [-20, 40, 120], 1, 50)).toEqual({ ok: false, reason: 'invalid-bounds' });
});
it('push repairs insufficient initial gaps but none rejects untouched invalid gaps', () => {
  expect(run('push', [20, 20, 20], 1, 20)).toEqual(ok([10, 20, 30], 1));
  expect(run('none', [20, 20, 20], 0, 0)).toEqual({ ok: false, reason: 'minimum-distance' });
});
it('fractional minimum steps can push off the step grid without quantization', () => {
  const p = { ...policy, step: 4, minStepsBetweenValues: 0.5 };
  expect(run('push', [0, 4, 8], 0, 4, [0, 4, 8], p)).toEqual(ok([4, 6, 8], 0));
});
it('swap never mutates frozen active and initial history and returns independent output', () => {
  const values = Object.freeze([30, 80, 90]);
  const start = Object.freeze([20, 40, 60]);
  const result = run('swap', values, 1, 20, start);
  expect(result).toEqual(ok([20, 40, 60], 0, true));
  if (result.ok) result.values[0] = -10;
  expect(values).toEqual([30, 80, 90]);
  expect(start).toEqual([20, 40, 60]);
});
it('diagnoses malformed history without evaluating its ordinary accessors', () => {
  let reads = 0;
  const history = [20, 40];
  Object.defineProperty(history, '1', {
    get() {
      reads++;
      return 40;
    },
  });
  expect(run('swap', [20, 40], 0, 50, history)).toEqual({
    ok: false,
    reason: 'invalid-value-shape',
  });
  expect(reads).toBe(0);
});
