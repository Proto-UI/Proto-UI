import { describe, expect, it } from 'vitest';
import {
  prepareSliderModel,
  sliderPointerValue,
  sliderAxisPosition,
  sliderValueAtPosition,
  proposeSliderValue,
  closestSliderThumb,
  sliderThumbBounds,
  sliderIndicatorInterval,
  sliderKeyboardValue,
  sliderCommitChanged,
  type SliderModel,
  type SliderModelOptions,
} from '../../models/slider-value-model';
function model(value: number | readonly number[], options: SliderModelOptions = {}): SliderModel {
  const r = prepareSliderModel(value, options);
  if (!r.ok) throw Error(r.reason);
  return r.model;
}
describe('draft Slider pure model; no mounted/runtime admission', () => {
  it('preserves shape, clones frozen input, and sorts index slots', () => {
    const input = Object.freeze([80, 20, 50]),
      m = model(input);
    expect(m.values).toEqual([20, 50, 80]);
    expect(input).toEqual([80, 20, 50]);
    expect(m.shape).toBe('array');
    expect(model([20]).shape).toBe('array');
    expect(model(20).shape).toBe('scalar');
    expect(Object.isFrozen(m.values)).toBe(true);
  });
  it.each([[], [NaN], [Infinity], [, 20], [20, undefined], ['20'], null])(
    'rejects invalid value %j',
    (input) => {
      expect(prepareSliderModel(input).ok).toBe(false);
    }
  );
  it.each([
    { min: 10, max: 0 },
    { step: 0 },
    { step: Infinity },
    { minStepsBetweenValues: -1 },
    { minStepsBetweenValues: 0.5 },
    { minStepsBetweenValues: Number.MAX_VALUE, step: 2 },
    { largeStep: NaN },
  ])('rejects invalid policy %j', (options) => {
    expect(prepareSliderModel([20, 80], options).ok).toBe(false);
  });
  it('normalizes decimal controlled sample as a pure proposal', () => {
    const m = model([0.3, 0.7], { max: 1, step: 0.1 });
    expect(m.values).toEqual([0.3, 0.7]);
    expect(proposeSliderValue(m, 0, 0.46, 'keyboard').model.values).toEqual([0.5, 0.7]);
    expect(m.values).toEqual([0.3, 0.7]);
  });
  it('rejects infeasible spacing and invalid owner spacing', () => {
    expect(prepareSliderModel([10, 20, 30], { minStepsBetweenValues: 60 }).ok).toBe(false);
    expect(prepareSliderModel([20, 25], { minStepsBetweenValues: 10 }).ok).toBe(false);
  });
  it('permits equal bounds only with zero gap', () => {
    expect(model([5, 5], { min: 5, max: 5 }).values).toEqual([5, 5]);
    expect(prepareSliderModel([5, 5], { min: 5, max: 5, minStepsBetweenValues: 1 }).ok).toBe(false);
  });
  it('none clamps a single slot to spaced neighbors', () => {
    const m = model([20, 50, 80], { minStepsBetweenValues: 10, thumbCollisionBehavior: 'none' });
    expect(proposeSliderValue(m, 1, 95, 'pointer').model.values).toEqual([20, 70, 80]);
    expect(proposeSliderValue(m, 1, -10, 'pointer').model.values).toEqual([20, 30, 80]);
  });
  it('push propagates and does not restore neighbors on return', () => {
    const m = model([20, 50, 80], { minStepsBetweenValues: 10 });
    const next = proposeSliderValue(m, 0, 95, 'pointer').model;
    expect(next.values).toEqual([80, 90, 100]);
    expect(proposeSliderValue(next, 0, 20, 'pointer').model.values).toEqual([20, 90, 100]);
    expect(proposeSliderValue(m, 2, 0, 'pointer').model.values).toEqual([0, 10, 20]);
  });
  it('swap transfers one sorted slot and gives a data-only focus destination', () => {
    const m = model([20, 50, 80], { minStepsBetweenValues: 10, thumbCollisionBehavior: 'swap' });
    const f = proposeSliderValue(m, 0, 60, 'pointer', m.values);
    expect(f.model.values).toEqual([40, 60, 80]);
    expect(f.activeIndex).toBe(1);
    expect(f.swapped).toBe(true);
    const b = proposeSliderValue(f.model, 1, 30, 'pointer', m.values);
    expect(b.model.values).toEqual([30, 50, 80]);
    expect(b.activeIndex).toBe(0);
  });
  it.each(['push', 'swap', 'none'] as const)(
    'keyboard never pushes/swaps with %s pointer policy',
    (behavior) => {
      const m = model([20, 50, 80], {
        minStepsBetweenValues: 10,
        thumbCollisionBehavior: behavior,
      });
      const r = proposeSliderValue(m, 1, 100, 'keyboard');
      expect(r.model.values).toEqual([20, 70, 80]);
      expect(r.activeIndex).toBe(1);
    }
  );
  it('invalid index or nonfinite request leaves source unchanged', () => {
    const m = model([20, 80]);
    for (const i of [-1, 2, 0.5, NaN])
      expect(proposeSliderValue(m, i, 50, 'pointer').changed).toBe(false);
    for (const v of [NaN, Infinity, -Infinity])
      expect(proposeSliderValue(m, 0, v, 'pointer').changed).toBe(false);
  });
  it('nearest center chooses later tie, skips disabled, honors live explicit origin', () => {
    const m = model([20, 50, 80]);
    expect(closestSliderThumb(m, 0.35)).toBe(1);
    expect(closestSliderThumb(m, 0.35, [1])).toBe(0);
    expect(closestSliderThumb(m, 0.99, [], 0)).toBe(0);
    expect(closestSliderThumb(m, 0.99, [0], 0)).toBe(2);
    expect(closestSliderThumb(m, 0.5, [0, 1, 2])).toBe(-1);
    expect(closestSliderThumb(m, NaN)).toBe(-1);
  });
  it('stacked maximum origins select first enabled matching index', () => {
    const m = model([30, 100, 100]);
    expect(closestSliderThumb(m, 1, [], 2)).toBe(1);
    expect(closestSliderThumb(m, 1, [1], 2)).toBe(2);
  });
  it('Indicator projects scalar fill, outer range, and explicit interval', () => {
    expect(sliderIndicatorInterval(model(30))).toEqual({ start: 0, end: 30, size: 30 });
    const m = model([20, 50, 80]);
    expect(sliderIndicatorInterval(m)).toEqual({ start: 20, end: 80, size: 60 });
    expect(sliderIndicatorInterval(m, 1, 2)).toEqual({ start: 50, end: 80, size: 30 });
    expect(sliderIndicatorInterval(m, 2, 1)).toBe(null);
    expect(sliderIndicatorInterval(m, 0, 4)).toBe(null);
  });
  it('neighbor ARIA and Home/End bounds describe one keyboard-editable slot', () => {
    const m = model([20, 50, 80], { minStepsBetweenValues: 10 });
    expect(sliderThumbBounds(m, 0)).toEqual({ min: 0, max: 40 });
    expect(sliderThumbBounds(m, 1)).toEqual({ min: 30, max: 70 });
    expect(sliderThumbBounds(m, 2)).toEqual({ min: 60, max: 100 });
    expect(sliderKeyboardValue(m, 1, 'Home')).toBe(30);
    expect(sliderKeyboardValue(m, 1, 'End')).toBe(70);
  });
  it('largeStep is absolute and RTL changes horizontal arrows only', () => {
    const m = model(50, { step: 2, largeStep: 12 });
    expect(sliderKeyboardValue(m, 0, 'PageUp')).toBe(62);
    expect(sliderKeyboardValue(m, 0, 'ArrowRight', { shiftKey: true })).toBe(62);
    expect(sliderKeyboardValue(m, 0, 'ArrowRight', { direction: 'rtl' })).toBe(48);
    expect(sliderKeyboardValue(m, 0, 'ArrowUp', { direction: 'rtl' })).toBe(52);
    expect(sliderKeyboardValue(m, 0, 'Tab')).toBe(null);
    expect(sliderKeyboardValue(m, 0, 'ArrowUp', { ctrlKey: true })).toBe(null);
  });
  it('keeps finite overflowing endpoints and subnormal values', () => {
    expect(model(10, { min: 0, max: 10, step: 3 }).values).toEqual([10]);
    const limit = Number.MAX_VALUE,
      m = model([-limit, 0, limit], { min: -limit, max: limit });
    expect(sliderIndicatorInterval(m)!.start).toBeCloseTo(0, 10);
    expect(sliderIndicatorInterval(m)!.end).toBe(100);
    expect(closestSliderThumb(m, 0.5)).toBe(1);
    const tiny = model([0, 1e-323, 2e-323], { max: 2e-323, step: Number.MIN_VALUE });
    expect(proposeSliderValue(tiny, 0, Number.MIN_VALUE, 'pointer').model.values[0]).toBe(
      Number.MIN_VALUE
    );
  });
  it('commit cannot turn a rejected proposal or cancellation into an accepted owner value', () => {
    const start = model([20, 80]),
      next = proposeSliderValue(start, 0, 30, 'pointer').model;
    expect(sliderCommitChanged(start, next, { accepted: false, canceled: false })).toBe(false);
    expect(sliderCommitChanged(start, start, { accepted: true, canceled: false })).toBe(false);
    expect(sliderCommitChanged(start, next, { accepted: true, canceled: true })).toBe(false);
    expect(sliderCommitChanged(start, next, { accepted: true, canceled: false })).toBe(true);
  });
  it.each(['push', 'swap', 'none'] as const)(
    'repeated %s samples preserve finite sorted spaced bounds and input immutability',
    (behavior) => {
      let m = model([10, 30, 60, 90], {
        minStepsBetweenValues: 5,
        thumbCollisionBehavior: behavior,
      });
      for (let i = 0; i < 120; i++) {
        const before = [...m.values],
          r = proposeSliderValue(m, i % 4, ((i * 37) % 141) - 20, 'pointer', [10, 30, 60, 90]);
        expect(m.values).toEqual(before);
        m = r.model;
        expect(m.values.every(Number.isFinite)).toBe(true);
        expect(m.values[0]).toBeGreaterThanOrEqual(0);
        expect(m.values[3]).toBeLessThanOrEqual(100);
        for (let j = 1; j < 4; j++) expect(m.values[j] - m.values[j - 1]).toBeGreaterThanOrEqual(5);
      }
    }
  );
  it('makes normalization permutation explicit and keeps duplicate ties stable', () => {
    const input = Object.freeze([80, 20, 20]),
      r = prepareSliderModel(input);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.normalization).toEqual({ reordered: true, sourceIndices: [1, 2, 0] });
    expect(input).toEqual([80, 20, 20]);
    expect(model([20, 20]).values).toEqual([20, 20]);
    expect(prepareSliderModel([20, 20], { minStepsBetweenValues: 1 }).ok).toBe(false);
  });
  it.each([
    [0.3, 0.7, 0.1, 0.449999, 0.4],
    [0.3, 0.7, 0.1, 0.450001, 0.5],
    [-0.3, 0.7, 0.1, -0.250001, -0.3],
    [-0.3, 0.7, 0.1, -0.249999, -0.2],
    [0, 1, 0.25, 0.125, 0.25],
    [0, 1, 0.25, 0.124999, 0],
  ])('decimal step boundary [%s,%s], step %s, input %s', (min, max, step, input, expected) => {
    const m = model(min, { min, max, step });
    expect(proposeSliderValue(m, 0, input, 'keyboard').model.values[0]).toBeCloseTo(expected, 13);
  });
  it.each([
    [-Number.MAX_VALUE, Number.MAX_VALUE, 0],
    [-Number.MAX_VALUE, Number.MAX_VALUE / 2, -Number.MAX_VALUE / 4],
    [-Number.MAX_VALUE / 2, Number.MAX_VALUE, Number.MAX_VALUE / 4],
  ])('finite pointer interpolation despite overflowing span [%s,%s]', (min, max, mid) => {
    const m = model(0, { min, max });
    expect(sliderValueAtPosition(m, 0)).toBe(min);
    expect(sliderValueAtPosition(m, 1)).toBe(max);
    const actual = sliderValueAtPosition(m, 0.5)!;
    expect(Number.isFinite(actual)).toBe(true);
    if (mid === 0) expect(actual).toBe(0);
    else expect(actual / mid).toBeCloseTo(1, 13);
    expect(sliderValueAtPosition(m, NaN)).toBe(null);
  });
  it('RTL and vertical transform coordinates, never sorted value order', () => {
    const m = model([20, 50, 80]);
    expect(sliderAxisPosition(0.2, 'horizontal', 'ltr')).toBe(0.2);
    expect(sliderAxisPosition(0.2, 'horizontal', 'rtl')).toBe(0.8);
    expect(sliderAxisPosition(0.2, 'vertical', 'ltr')).toBe(0.8);
    expect(sliderAxisPosition(0.2, 'vertical', 'rtl')).toBe(0.8);
    expect(closestSliderThumb(m, sliderAxisPosition(0.2, 'horizontal', 'rtl')!)).toBe(2);
    expect(m.values).toEqual([20, 50, 80]);
  });
  it('shape or cardinality changes invalidate commit even after acceptance', () => {
    expect(sliderCommitChanged(model(20), model([30]), { accepted: true, canceled: false })).toBe(
      false
    );
    expect(
      sliderCommitChanged(model([20, 80]), model([30]), { accepted: true, canceled: false })
    ).toBe(false);
  });

  it('large finite gaps do not overflow intermediate multiplication into a candidate', () => {
    const M = Number.MAX_VALUE;
    for (const values of [
      [-M, 0, M],
      [-1e308, -5e307, 0, 5e307, 1e308],
    ]) {
      const m = model(values, {
        min: values[0],
        max: values[values.length - 1],
        step: values.length === 3 ? M : 5e307,
        minStepsBetweenValues: 1,
      });
      for (let i = 0; i < values.length; i++) {
        const r = proposeSliderValue(m, i, M, 'pointer');
        expect(r.model.values.every(Number.isFinite)).toBe(true);
        expect(r.model.values).toEqual(values);
      }
    }
  });
  it.each(['push', 'swap', 'none'] as const)(
    'exact positive/negative endpoints survive %s collision',
    (behavior) => {
      const max = 1.2345678901234567;
      const m = model([0, 1], { max, step: 0.1, thumbCollisionBehavior: behavior });
      const out = proposeSliderValue(m, 1, max, 'pointer');
      expect(out.changed).toBe(true);
      expect(Object.is(out.model.values[1], max)).toBe(true);
      const min = -max;
      const n = model([-1, 0], { min, max: 0, step: 0.1, thumbCollisionBehavior: behavior });
      const low = proposeSliderValue(n, 0, min, 'pointer');
      expect(low.changed).toBe(true);
      expect(Object.is(low.model.values[0], min)).toBe(true);
    }
  );
  it.each(['push', 'swap', 'none'] as const)(
    '%s preserves the lattice beside an off-grid endpoint',
    (behavior) => {
      const options = {
        max: 9.5,
        step: 3,
        minStepsBetweenValues: 1,
        thumbCollisionBehavior: behavior,
      };
      const m = model([0, 9.5], options),
        out = proposeSliderValue(m, 0, 9.5, 'pointer');
      expect(out.model.values).toEqual([6, 9.5]);
      expect(model(out.model.values, options).values).toEqual(out.model.values);
      expect(sliderThumbBounds(out.model, 0)).toEqual({ min: 0, max: 6 });
    }
  );
  it.each(['push', 'swap', 'none'] as const)(
    '%s preserves same-value and untouched exact endpoints',
    (behavior) => {
      for (const max of [1.2345678901234567, 1.2345678901234123]) {
        const m = model([0, max], { max, step: 0.1, thumbCollisionBehavior: behavior });
        const same = proposeSliderValue(m, 1, max, 'pointer');
        expect(same.diagnostic).toBe(null);
        expect(same.changed).toBe(false);
        expect(Object.is(same.model.values[1], max)).toBe(true);
        const edit = proposeSliderValue(m, 0, 0.1, 'pointer');
        expect(edit.diagnostic).toBe(null);
        expect(edit.model.values[0]).toBe(0.1);
        expect(Object.is(edit.model.values[1], max)).toBe(true);
        const min = -max,
          n = model([min, 0], { min, max: 0, step: 0.1, thumbCollisionBehavior: behavior });
        const low = proposeSliderValue(n, 0, min, 'keyboard');
        expect(low.diagnostic).toBe(null);
        expect(low.changed).toBe(false);
        expect(Object.is(low.model.values[0], min)).toBe(true);
      }
    }
  );
  it.each(['push', 'swap', 'none'] as const)(
    '%s proposals are nonmutating, ordered, spaced, on projected grid and owner-writeback idempotent',
    (behavior) => {
      const policies = [
        { min: 0, max: 9.5, step: 3, minStepsBetweenValues: 1 },
        { min: -0.3, max: 1.2345678901234567, step: 0.1, minStepsBetweenValues: 1 },
        { min: -1.2345678901234567, max: 1, step: 0.1, minStepsBetweenValues: 0 },
        { min: 0, max: 1, step: 0.1, minStepsBetweenValues: 3 },
        { min: -1e308, max: 1e308, step: 5e307, minStepsBetweenValues: 1 },
        { min: 0, max: 2e-323, step: Number.MIN_VALUE, minStepsBetweenValues: 1 },
      ];
      for (const policy of policies)
        for (const source of ['pointer', 'keyboard'] as const) {
          const options = { ...policy, thumbCollisionBehavior: behavior };
          let m = model([policy.min, policy.max], options),
            changes = 0;
          const initial = m.values;
          expect(model(m.values, options).values).toEqual(m.values);
          for (let turn = 0; turn < 32; turn++) {
            const previous = [...m.values],
              input = sliderValueAtPosition(m, ((turn * 13) % 33) / 32)!;
            const p = proposeSliderValue(m, turn % 2, input, source, initial);
            expect(p.diagnostic).toBe(null);
            expect(m.values).toEqual(previous);
            expect(Object.isFrozen(m.values)).toBe(true);
            m = p.model;
            changes += Number(p.changed);
            expect(m.values.every(Number.isFinite)).toBe(true);
            expect(m.values[0]).toBeGreaterThanOrEqual(policy.min);
            expect(m.values[1]).toBeLessThanOrEqual(policy.max);
            expect(m.values[0]).toBeLessThanOrEqual(m.values[1]);
            // Re-admission checks projected grid and exact-decimal spacing together;
            // equality rules out repair/normalization silently changing a proposal.
            const admitted = prepareSliderModel(m.values, options);
            expect(admitted.ok).toBe(true);
            if (admitted.ok) {
              expect(admitted.model.values).toEqual(m.values);
              expect(model(admitted.model.values, options).values).toEqual(m.values);
              expect(admitted.normalization.reordered).toBe(false);
              for (let index = 0; index < m.values.length; index++) {
                const bounds = sliderThumbBounds(m, index)!;
                expect(bounds.min).toBeLessThanOrEqual(m.values[index]);
                expect(bounds.max).toBeGreaterThanOrEqual(m.values[index]);
                const same = proposeSliderValue(m, index, m.values[index], source);
                expect(same.diagnostic).toBe(null);
                expect(same.changed).toBe(false);
                expect(same.model.values).toEqual(m.values);
              }
            }
          }
          expect(changes).toBeGreaterThan(0);
        }
    }
  );
  it.each(['push', 'swap', 'none'] as const)(
    '%s retains admitted projected duplicates in their own intervals and on same-value requests',
    (behavior) => {
      for (const options of [
        { min: 0.1, max: 1, step: 0.12345678901234566 },
        { min: -3.4950050432235004e-182, max: 8.91246758857742e-182, step: 6.664972004853189e-182 },
        { min: 0, max: 1, step: 0.12345678901234566 },
      ]) {
        const input = Object.freeze([
          options.min,
          options.min + options.step,
          options.min + options.step,
          options.max,
        ]);
        const m = model(input, { ...options, thumbCollisionBehavior: behavior });
        for (let index = 0; index < m.values.length; index++) {
          const bounds = sliderThumbBounds(m, index)!;
          expect(bounds.min).toBeLessThanOrEqual(m.values[index]);
          expect(bounds.max).toBeGreaterThanOrEqual(m.values[index]);
          for (const source of ['pointer', 'keyboard'] as const) {
            const same = proposeSliderValue(m, index, m.values[index], source);
            expect(same.diagnostic).toBe(null);
            expect(same.changed).toBe(false);
            expect(same.model.values).toEqual(m.values);
          }
        }
        expect(model(m.values, options).values).toEqual(m.values);
      }
    }
  );
  it.each([0, 1, 2])(
    'matches independently enumerated projected bounds with %s minimum steps',
    (steps) => {
      // Small finite domains use exhaustive enumeration, not the model's search.
      // Coefficients are fixed 17-place decimal integers, including two rounding
      // directions and a dense grid with many indices mapping to the same Number.
      for (const [low, high, step] of [
        [10000000000000000n, 100000000000000000n, 12345678901234566n],
        [-100000000000000000n, -10000000000000000n, 12345678901234566n],
        [-50000000000000000n, 50000000000000000n, 12345678901234566n],
        [100000000000000000n, 100000000000000040n, 1n],
      ]) {
        const asNumber = (n: bigint) => Number(`${n}e-17`);
        const asCoefficient = (v: number) => {
          const [whole, fraction = ''] = Math.abs(v).toString().split('.');
          return BigInt(whole + fraction.padEnd(17, '0')) * (v < 0 ? -1n : 1n);
        };
        const points = [asNumber(high)];
        for (let k = low; k <= high; k += step) points.push(asNumber(k));
        const domain = [...new Set(points)].sort((a, b) => a - b);
        const gap = step * BigInt(steps),
          options = {
            min: asNumber(low),
            max: asNumber(high),
            step: asNumber(step),
            minStepsBetweenValues: steps,
          };
        let tested = 0;
        for (const left of domain)
          for (const right of domain) {
            if (asCoefficient(right) - asCoefficient(left) < gap) continue;
            const expectedLow = domain.find((v) => asCoefficient(v) >= asCoefficient(left) + gap)!;
            const expectedHigh = domain
              .filter((v) => asCoefficient(v) <= asCoefficient(right) - gap)
              .at(-1)!;
            for (const behavior of ['push', 'swap', 'none'] as const) {
              const m = model([left, right], { ...options, thumbCollisionBehavior: behavior });
              expect(m.values).toEqual([left, right]);
              expect(sliderThumbBounds(m, 0)).toEqual({ min: options.min, max: expectedHigh });
              expect(sliderThumbBounds(m, 1)).toEqual({ min: expectedLow, max: options.max });
              for (const source of ['pointer', 'keyboard'] as const)
                for (const index of [0, 1]) {
                  const same = proposeSliderValue(m, index, m.values[index], source);
                  expect(same.diagnostic).toBe(null);
                  expect(same.changed).toBe(false);
                  expect(same.model.values).toEqual(m.values);
                }
            }
            tested++;
          }
        expect(tested).toBeGreaterThan(0);
      }
    }
  );
  it('searches dense projection plateaus across an overflowing finite span within its bound', () => {
    const M = Number.MAX_VALUE,
      options = { min: -M, max: M, step: Number.MIN_VALUE },
      m = model([-M, 0, M], options);
    expect(m.values).toEqual([-M, 0, M]);
    expect(sliderThumbBounds(m, 1)).toEqual({ min: -M, max: M });
    const same = proposeSliderValue(m, 1, 0, 'pointer');
    expect(same.diagnostic).toBe(null);
    expect(same.changed).toBe(false);
    expect(same.model.values).toEqual(m.values);
  });
  it('diagnoses rejected requests explicitly and serializes no oracle arithmetic', () => {
    expect(prepareSliderModel('1'.repeat(5000))).toEqual({ ok: false, reason: 'invalid-value' });
    expect(prepareSliderModel([1n])).toEqual({ ok: false, reason: 'invalid-value' });
    expect(Object.is(model(-0, { min: -0, max: 1 }).values[0], 0)).toBe(true);
    const m = model([0, 1], { max: 1, step: 0.1 });
    expect(proposeSliderValue(m, -1, 0.2, 'pointer').diagnostic).toBe('invalid-index');
    expect(proposeSliderValue(m, 0, Infinity, 'pointer').diagnostic).toBe('invalid-request');
    const copy = JSON.parse(JSON.stringify(proposeSliderValue(m, 0, 0.3, 'pointer')));
    expect(copy.model.values).toEqual([0.3, 1]);
    expect(copy.diagnostic).toBe(null);
    // Under the declared decimal oracle, rounded MAX_VALUE/2 is slightly larger
    // than one fourth of the exact decimal span. Diagnose, never relax the gap.
    const M = Number.MAX_VALUE;
    expect(
      prepareSliderModel([-M, -M / 2, 0, M / 2, M], {
        min: -M,
        max: M,
        step: M / 2,
        minStepsBetweenValues: 1,
      })
    ).toEqual({ ok: false, reason: 'infeasible-grid-spacing' });
  });
  it('thumb-origin off-center press does not seek; track-origin press does', () => {
    const m = model([20, 50, 80]);
    const origin = { kind: 'thumb' as const, startValue: 50 };
    expect(sliderPointerValue(m, origin, { phase: 'start', position: 0.56, totalDelta: 0 })).toBe(
      50
    );
    expect(sliderPointerValue(m, origin, { phase: 'move', position: 0.6, totalDelta: 0.04 })).toBe(
      54
    );
    expect(sliderPointerValue(m, origin, { phase: 'end', position: 0.56, totalDelta: 0 })).toBe(50);
    expect(
      sliderPointerValue(m, { kind: 'track' }, { phase: 'start', position: 0.56, totalDelta: 0 })
    ).toBeCloseTo(56, 12);
    expect(sliderPointerValue(m, origin, { phase: 'move', position: 1, totalDelta: 2 })).toBe(100);
    expect(sliderPointerValue(m, origin, { phase: 'move', position: 0.56, totalDelta: NaN })).toBe(
      null
    );
  });
});
