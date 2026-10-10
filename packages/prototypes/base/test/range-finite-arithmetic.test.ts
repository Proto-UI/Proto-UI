import { afterEach, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { quantize } from '../src/progress/range';
import { meterRoot } from '../src/meter';
import { sliderRoot } from '../src/slider';
import { numberFieldRoot } from '../src/number-field';
for (const proto of [meterRoot, sliderRoot, numberFieldRoot]) AdaptToWebComponent(proto);
const flush = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});
const limit = Number.MAX_VALUE;
it('quantizes a finite interior value without turning overflowing offset into the upper endpoint', () => {
  const value = limit / 2;
  const actual = quantize(value, -limit, limit, 1);
  expect(actual).toBeLessThan(limit);
  expect(actual / value).toBeCloseTo(1, 12);
});
it.each([
  [limit / 2, -limit, limit, limit / 2, limit / 2],
  [0, -limit, limit, limit, 0],
  [limit / 2, -limit, limit, limit, limit],
  [1, 0, limit, Number.MIN_VALUE, 1],
  [-1, -limit, limit, Number.MIN_VALUE, -1],
])(
  'keeps overflow-path step phase and upward midpoint policy for %s',
  (value, min, max, step, expected) => {
    expect(quantize(value, min, max, step)).toBe(expected);
  }
);
it.each([
  [6.24, 0, 10, 0.5, 6],
  [-2.25, -3, 3, 0.5, -2],
  [-4.7, -5, 5, 0.25, -4.75],
  [10, 0, 10, 3, 9],
  [11, 0, 11, 3, 11],
  [20, 0, 10, 0.5, 10],
  [-20, -10, 0, 0.5, -10],
  [1e-323, 0, 2e-323, 5e-324, 1e-323],
  [5e-324, -5e-324, 1e-323, 5e-324, 5e-324],
  [2, 0, 10, 0, 2],
  [2, 0, 10, Infinity, 2],
  [2, 0, 10, NaN, 2],
])(
  'preserves ordinary/subnormal/clamped quantization for %s',
  (value, min, max, step, expected) => {
    expect(quantize(value, min, max, step)).toBe(expected);
  }
);
for (const name of ['base-slider-root', 'base-number-field-root'])
  it(`${name} preserves a finite interior owner and controlled proposal`, async () => {
    const el = document.createElement(name) as any;
    setElementProps(el, { min: -limit, max: limit, step: 1, value: limit / 2 });
    document.body.append(el);
    await flush();
    expect(el.getExposes().value.get() / (limit / 2)).toBeCloseTo(1, 12);
    const proposals: number[] = [];
    el.addEventListener('valueChange', (e: CustomEvent) => proposals.push(e.detail.value));
    el.getExposes().requestValue(limit / 4);
    await flush();
    expect(proposals).toHaveLength(1);
    expect(proposals[0] / (limit / 4)).toBeCloseTo(1, 12);
    expect(el.getExposes().value.get() / (limit / 2)).toBeCloseTo(1, 12);
    setElementProps(el, { min: -limit, max: limit, step: 1, value: limit / 4 });
    await flush();
    expect(el.getExposes().value.get() / (limit / 4)).toBeCloseTo(1, 12);
  });
it.each([
  [1e308, 1.7e308, 1.35e308, 1.2e308, 1.5e308],
  [-1.7e308, -1e308, -1.35e308, -1.5e308, -1.2e308],
  [-limit, limit, 0, -1, 1],
  [0, 100, 50, 25, 75],
  [5, 5, 5, 5, 5],
  [1e-323, 2e-323, 1.5e-323, 1e-323, 2e-323],
])(
  'Meter implicit optimum equals explicit mathematical midpoint in [%s,%s]',
  async (min, max, value, low, high) => {
    const make = (explicit: boolean) => {
      const el = document.createElement('base-meter-root') as any;
      setElementProps(el, { min, max, value, low, high, ...(explicit ? { optimum: value } : {}) });
      document.body.append(el);
      return el;
    };
    const implicit = make(false),
      explicit = make(true);
    await flush();
    expect(explicit.getExposes().status.get()).toBe('optimal');
    expect(implicit.getExposes().status.get()).toBe('optimal');
    expect(implicit.getExposes().percentage.get()).toBe(explicit.getExposes().percentage.get());
    expect(Number.isFinite(implicit.getExposes().value.get())).toBe(true);
  }
);
it('matches an independent integer-grid oracle when the original arithmetic overflows', () => {
  let checked = 0;
  for (const value of [
    -limit,
    -limit * 0.9,
    -limit / 2,
    -1,
    0,
    1,
    limit / 4,
    limit / 2,
    limit * 0.9,
    limit,
  ]) {
    for (const step of [1, 3, limit / 4, limit / 2, limit * 0.75, limit]) {
      const prior = -limit + Math.round((value + limit) / step) * step;
      if (Number.isFinite(prior)) continue;
      // These binary64 inputs are integers: BigInt conversion retains their exact values.
      const lower = BigInt(-limit),
        upper = BigInt(limit),
        v = BigInt(value),
        s = BigInt(step);
      const count = ((v - lower) * 2n + s) / (2n * s);
      const snapped = lower + count * s;
      const bounded = snapped < lower ? lower : snapped > upper ? upper : snapped;
      const expected = Number(bounded),
        actual = quantize(value, -limit, limit, step);
      expect(Number.isFinite(actual)).toBe(true);
      expect(Math.abs(actual - expected) / Math.max(1, Math.abs(expected))).toBeLessThan(1e-12);
      checked++;
    }
  }
  expect(checked).toBeGreaterThan(15);
});
