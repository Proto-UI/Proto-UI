import { describe, expect, it, vi } from 'vitest';
import {
  acceptValuesOwner,
  compareValuesOwnerInput,
  constrainValuesRequest,
  normalizeValuesOwner,
  projectValuesOwner,
  sliderValuesKeyboard,
  validateValuesPolicy,
  type SliderValuesPolicy,
} from '../src/slider/values-numeric';

// NEW REBUILD CANDIDATE, 2026-10-11. These are not recovered old file bytes.
// Reconstructs 64 cases retained in the author's earlier task context, updating
// owner-result expectations for explicit rawValues, plus one NEW raw/display
// isolation case and nine NEW split-API cases, followed by one independently
// reproduced inherited-index setter regression (75 current cases in total).
// The lost later 65th historical case is not known/recovered.
// This colocated Vitest file must also be rerun in the exact integration
// checkout and independently reviewed. Update the helper import on integration.
// Source-informed expectations concern Base UI v1.6.0 owner/keyboard behavior;
// tests import only this independent helper, never third-party reference code.
const policy: SliderValuesPolicy = { min: 0, max: 100, step: 1 };

it('copies own numeric entries without invoking an inherited numeric-index setter', () => {
  // Keep the pollution interval wholly synchronous and outside framework calls.
  // Restore the exact prior descriptor before inspecting results or asserting.
  const previous = Object.getOwnPropertyDescriptor(Object.prototype, '0');
  const input = Object.freeze([20]);
  const other = Object.freeze([30]);
  let setterCalls = 0;
  let accepted: ReturnType<typeof acceptValuesOwner> | undefined;
  let displayed: ReturnType<typeof normalizeValuesOwner> | undefined;
  let requested: ReturnType<typeof constrainValuesRequest> | undefined;
  let keyboard: number | null | undefined;
  let compared: boolean | undefined;
  try {
    Object.defineProperty(Object.prototype, '0', {
      configurable: true,
      set(_value: unknown) {
        setterCalls += 1;
      },
    });
    accepted = acceptValuesOwner(input);
    displayed = normalizeValuesOwner(input, 0, 100);
    requested = constrainValuesRequest(input, 0, 25, policy);
    keyboard = sliderValuesKeyboard(input, 0, 'ArrowUp', policy);
    compared = compareValuesOwnerInput(input, other);
  } finally {
    if (previous) Object.defineProperty(Object.prototype, '0', previous);
    else delete (Object.prototype as Record<string, unknown>)['0'];
  }

  expect(setterCalls).toBe(0);
  expect(accepted).toEqual({ ok: true, rawValues: [20], shape: 'array' });
  if (!accepted?.ok) throw new Error('owner acceptance failed');
  expect(Object.getOwnPropertyDescriptor(accepted.rawValues, '0')).toEqual({
    value: 20,
    writable: true,
    enumerable: true,
    configurable: true,
  });
  expect(displayed).toEqual({
    ok: true,
    rawValues: [20],
    values: [20],
    shape: 'array',
    reordered: false,
  });
  expect(requested).toEqual({ ok: true, values: [25] });
  expect(keyboard).toBe(21);
  expect(compared).toBe(false);
  expect(input).toEqual([20]);
  expect(other).toEqual([30]);
});

describe('NEW rebuild: separate raw acceptance, display projection and raw equality', () => {
  it('captures safe scalar owner independently of a broken display policy', () => {
    const owner = acceptValuesOwner(120);
    expect(owner).toEqual({ ok: true, rawValues: [120], shape: 'scalar' });
    if (!owner.ok) throw new Error(owner.reason);
    expect(projectValuesOwner(owner, 10, 0)).toEqual({
      ok: false,
      reason: 'invalid-bounds',
    });
    expect(projectValuesOwner(owner, NaN, 100)).toEqual({
      ok: false,
      reason: 'invalid-bounds',
    });
    expect(owner).toEqual({ ok: true, rawValues: [120], shape: 'scalar' });
  });

  it('accepts a raw array with original order, duplicates and outside-bound entries', () => {
    const input = Object.freeze([120, 0.35, -20, 0.35]);
    const owner = acceptValuesOwner(input);
    expect(owner).toEqual({
      ok: true,
      rawValues: [120, 0.35, -20, 0.35],
      shape: 'array',
    });
    if (!owner.ok) throw new Error(owner.reason);
    expect(owner.rawValues).not.toBe(input);
    expect(input).toEqual([120, 0.35, -20, 0.35]);
  });

  it('reprojects from the raw scalar when bounds change instead of reusing clamped display', () => {
    const owner = acceptValuesOwner(120);
    if (!owner.ok) throw new Error(owner.reason);
    expect(projectValuesOwner(owner, 0, 100)).toMatchObject({
      rawValues: [120],
      values: [100],
    });
    expect(projectValuesOwner(owner, 0, 200)).toMatchObject({
      rawValues: [120],
      values: [120],
    });
    expect(owner.rawValues).toEqual([120]);
  });

  it('sorts an independent display copy without overwriting accepted order', () => {
    const owner = acceptValuesOwner([80, 20]);
    if (!owner.ok) throw new Error(owner.reason);
    const display = projectValuesOwner(owner, 0, 100);
    if (!display.ok) throw new Error(display.reason);
    expect(display.values).toEqual([20, 80]);
    expect(display.reordered).toBe(true);
    display.rawValues[0] = 999;
    display.values[0] = 555;
    expect(owner.rawValues).toEqual([80, 20]);
  });

  it('requires exactly one raw value for scalar projection and permits an empty array', () => {
    expect(projectValuesOwner({ shape: 'scalar', rawValues: [] }, 0, 100)).toEqual({
      ok: false,
      reason: 'invalid-value-shape',
    });
    expect(projectValuesOwner({ shape: 'scalar', rawValues: [1, 2] }, 0, 100)).toEqual({
      ok: false,
      reason: 'invalid-value-shape',
    });
    expect(projectValuesOwner({ shape: 'array', rawValues: [] }, 0, 100)).toEqual({
      ok: true,
      rawValues: [],
      values: [],
      shape: 'array',
      reordered: false,
    });
  });

  it('compares shape and array length rather than treating scalar and one-item array as equal', () => {
    expect(compareValuesOwnerInput(20, 20)).toBe(true);
    expect(compareValuesOwnerInput(20, [20])).toBe(false);
    expect(compareValuesOwnerInput([20], 20)).toBe(false);
    expect(compareValuesOwnerInput([], [])).toBe(true);
    expect(compareValuesOwnerInput([20], [20, 20])).toBe(false);
  });

  it('distinguishes raw order and out-of-bounds scalar values despite equal display', () => {
    expect(compareValuesOwnerInput([80, 20], [20, 80])).toBe(false);
    expect(compareValuesOwnerInput([80, 20], [80, 20])).toBe(true);
    expect(compareValuesOwnerInput(120, 100)).toBe(false);
    expect(compareValuesOwnerInput(120, 120)).toBe(true);
    expect(compareValuesOwnerInput([120, -20], [120, -20])).toBe(true);
  });

  it('rejects unsafe equality inputs without evaluating ordinary getters or iterators', () => {
    const getter = vi.fn(() => 20);
    const input = [20];
    Object.defineProperty(input, '0', { get: getter });
    expect(compareValuesOwnerInput(input, [20])).toBe(false);
    expect(compareValuesOwnerInput([20], input)).toBe(false);
    const iterated = [20];
    Object.defineProperty(iterated, Symbol.iterator, { get: getter });
    expect(compareValuesOwnerInput(iterated, [20])).toBe(false);
    expect(compareValuesOwnerInput(NaN, NaN)).toBe(false);
    expect(compareValuesOwnerInput(undefined, undefined)).toBe(false);
    expect(getter).not.toHaveBeenCalled();
  });

  it('canonicalizes signed zero for raw equality without mutating readonly caller input', () => {
    const owner = Object.freeze([-0, 5]);
    expect(compareValuesOwnerInput(-0, +0)).toBe(true);
    expect(compareValuesOwnerInput(owner, [0, 5])).toBe(true);
    expect(Object.is(owner[0], -0)).toBe(true);
    const accepted = acceptValuesOwner(owner);
    if (!accepted.ok) throw new Error(accepted.reason);
    expect(Object.is(accepted.rawValues[0], -0)).toBe(false);
  });
});

describe('Slider value owner numeric preparation', () => {
  it('distinguishes scalar, single array and empty array without quantizing', () => {
    expect(normalizeValuesOwner(0.35, 0, 1)).toEqual({
      ok: true,
      rawValues: [0.35],
      values: [0.35],
      shape: 'scalar',
      reordered: false,
    });
    expect(normalizeValuesOwner([0.35], 0, 1)).toEqual({
      ok: true,
      rawValues: [0.35],
      values: [0.35],
      shape: 'array',
      reordered: false,
    });
    expect(normalizeValuesOwner([], 0, 1)).toEqual({
      ok: true,
      rawValues: [],
      values: [],
      shape: 'array',
      reordered: false,
    });
  });

  it('clamps scalar display but preserves finite array owner values', () => {
    expect(normalizeValuesOwner(-2, 0, 1)).toMatchObject({
      rawValues: [-2],
      values: [0],
    });
    expect(normalizeValuesOwner(2, 0, 1)).toMatchObject({
      rawValues: [2],
      values: [1],
    });
    const input = Object.freeze([2, 0.35, 0.35, -2]);
    expect(normalizeValuesOwner(input, 0, 1)).toEqual({
      ok: true,
      rawValues: [2, 0.35, 0.35, -2],
      values: [-2, 0.35, 0.35, 2],
      shape: 'array',
      reordered: true,
    });
    expect(input).toEqual([2, 0.35, 0.35, -2]);
  });

  it('returns independent data and canonicalizes negative zero', () => {
    const input = [-0, 0, 10];
    const result = normalizeValuesOwner(input, -0, 100);
    expect(result).toMatchObject({
      ok: true,
      rawValues: [0, 0, 10],
      values: [0, 0, 10],
      reordered: false,
    });
    if (!result.ok) throw new Error(result.reason);
    expect(Object.is(result.values[0], -0)).toBe(false);
    expect(Object.is(result.rawValues[0], -0)).toBe(false);
    result.values[0] = 50;
    expect(Object.is(input[0], -0)).toBe(true);
    expect(normalizeValuesOwner(-0, -0, 1)).toMatchObject({
      rawValues: [0],
      values: [0],
    });
  });

  it('preserves full finite endpoints and sorts without span subtraction', () => {
    const min = -Number.MAX_VALUE;
    const max = Number.MAX_VALUE;
    expect(normalizeValuesOwner([max, min], min, max)).toMatchObject({
      rawValues: [max, min],
      values: [min, max],
      reordered: true,
    });
    expect(normalizeValuesOwner(1.2345678901234567, 0, 1.2345678901234567)).toMatchObject({
      values: [1.2345678901234567],
    });
  });

  it.each([null, undefined, '3', {}, new Number(3), new Float64Array([3])])(
    'rejects non-number/non-array owner %s',
    (input) => {
      expect(normalizeValuesOwner(input, 0, 1)).toEqual({
        ok: false,
        reason: 'invalid-values',
      });
    }
  );

  it.each([NaN, Infinity, -Infinity])('rejects nonfinite scalar or array entry %s', (input) => {
    expect(normalizeValuesOwner(input, 0, 1)).toEqual({
      ok: false,
      reason: 'invalid-value-entry',
    });
    expect(normalizeValuesOwner([input], 0, 1)).toEqual({
      ok: false,
      reason: 'invalid-value-entry',
    });
  });

  it('rejects sparse, nonnumber, extra-own-key and symbol inputs', () => {
    const sparse = new Array(2);
    sparse[1] = 1;
    const extra = Object.assign([1], { note: 'extra' });
    const symbol = [1];
    Object.defineProperty(symbol, Symbol('extra'), { value: 1 });
    const hidden = [1];
    Object.defineProperty(hidden, 'hidden', { value: 1 });
    for (const input of [sparse, extra, symbol, hidden]) {
      expect(normalizeValuesOwner(input, 0, 1)).toEqual({
        ok: false,
        reason: 'invalid-value-shape',
      });
    }
    expect(normalizeValuesOwner(['1'], 0, 1)).toEqual({
      ok: false,
      reason: 'invalid-value-entry',
    });
  });

  it('never evaluates own or inherited index accessors', () => {
    const getter = vi.fn(() => 1);
    const own = [1];
    Object.defineProperty(own, '0', { get: getter });
    expect(normalizeValuesOwner(own, 0, 1)).toEqual({
      ok: false,
      reason: 'invalid-value-shape',
    });
    const inherited = new Array(1);
    Object.setPrototypeOf(inherited, Object.create(Array.prototype, { 0: { get: getter } }));
    expect(normalizeValuesOwner(inherited, 0, 1)).toEqual({
      ok: false,
      reason: 'invalid-value-shape',
    });
    expect(getter).not.toHaveBeenCalled();
  });

  it('does not execute array subclass iterators, methods or coercions', () => {
    const called = vi.fn(() => {
      throw new Error('caller behavior must not execute');
    });
    class Input extends Array<number> {}
    for (const key of ['slice', 'sort', 'map', 'valueOf', 'toString', Symbol.iterator]) {
      Object.defineProperty(Input.prototype, key, { get: called });
    }
    const input = new Input(30, 10, 20);
    expect(normalizeValuesOwner(input, 0, 100)).toMatchObject({
      rawValues: [30, 10, 20],
      values: [10, 20, 30],
    });
    expect(called).not.toHaveBeenCalled();
  });

  it('rejects own iterator accessors without evaluating them', () => {
    const getter = vi.fn();
    const input = [1];
    Object.defineProperty(input, Symbol.iterator, { get: getter });
    expect(normalizeValuesOwner(input, 0, 100)).toMatchObject({ ok: false });
    expect(getter).not.toHaveBeenCalled();
  });

  it('reports thrown Proxy reflection without claiming trap isolation', () => {
    const input = new Proxy([1], {
      ownKeys() {
        throw new Error('uninspectable');
      },
    });
    expect(normalizeValuesOwner(input, 0, 100)).toEqual({
      ok: false,
      reason: 'uninspectable-values',
    });
  });

  // NEW case in this rebuild, not a claim to recover the missing old 65th case.
  it('retains raw owner order independently of display normalization and mutable output copies', () => {
    const input = Object.freeze([1.5, 0.35, -2, 0.35]);
    const result = normalizeValuesOwner(input, 0, 1);
    if (!result.ok) throw new Error(result.reason);
    expect(result.rawValues).toEqual([1.5, 0.35, -2, 0.35]);
    expect(result.values).toEqual([-2, 0.35, 0.35, 1.5]);
    expect(result.rawValues).not.toBe(result.values);
    expect(result.rawValues).not.toBe(input);
    result.values[0] = 100;
    expect(result.rawValues).toEqual([1.5, 0.35, -2, 0.35]);
    result.rawValues[1] = 99;
    expect(result.values).toEqual([100, 0.35, 0.35, 1.5]);
    expect(input).toEqual([1.5, 0.35, -2, 0.35]);
    const scalar = normalizeValuesOwner(2, 0, 1);
    const single = normalizeValuesOwner([2], 0, 1);
    expect(scalar).toEqual({
      ok: true,
      rawValues: [2],
      values: [1],
      shape: 'scalar',
      reordered: false,
    });
    expect(single).toEqual({
      ok: true,
      rawValues: [2],
      values: [2],
      shape: 'array',
      reordered: false,
    });
  });
});

describe('Slider operational Number policy and requests', () => {
  it('allows a degenerate bound, zero largeStep and fractional minimum steps', () => {
    expect(
      validateValuesPolicy({
        min: 0,
        max: 0,
        step: 1,
        largeStep: 0,
        minStepsBetweenValues: 0.5,
      })
    ).toBeNull();
    expect(
      constrainValuesRequest([10, 20], 0, 19, {
        ...policy,
        step: 2,
        minStepsBetweenValues: 0.5,
      })
    ).toEqual({ ok: true, values: [19, 20] });
  });

  it.each([
    [{ min: Infinity }, 'invalid-bounds'],
    [{ min: 101 }, 'invalid-bounds'],
    [{ max: NaN }, 'invalid-bounds'],
    [{ step: 0 }, 'invalid-step'],
    [{ step: -1 }, 'invalid-step'],
    [{ step: Infinity }, 'invalid-step'],
    [{ largeStep: -1 }, 'invalid-large-step'],
    [{ largeStep: NaN }, 'invalid-large-step'],
    [{ minStepsBetweenValues: -1 }, 'invalid-minimum-steps'],
    [{ minStepsBetweenValues: Infinity }, 'invalid-minimum-steps'],
    [{ step: Number.MAX_VALUE, minStepsBetweenValues: 2 }, 'nonfinite-intermediate'],
  ] as const)('diagnoses invalid policy %s', (change, reason) => {
    expect(validateValuesPolicy({ ...policy, ...change })).toEqual({
      ok: false,
      reason,
    });
  });

  it('clamps Root first, then neighbors, without quantization or pushing', () => {
    const input = Object.freeze([10, 20, 30]);
    expect(constrainValuesRequest(input, 1, 29.5, { ...policy, step: 3 })).toEqual({
      ok: true,
      values: [10, 29.5, 30],
    });
    expect(constrainValuesRequest(input, 1, 1000, policy)).toEqual({
      ok: true,
      values: [10, 30, 30],
    });
    expect(constrainValuesRequest(input, 1, -1000, policy)).toEqual({
      ok: true,
      values: [10, 10, 30],
    });
    expect(input).toEqual([10, 20, 30]);
  });

  it('preserves upstream ordering when owner neighbors are outside Root bounds', () => {
    expect(constrainValuesRequest([-20, -10], 0, 50, policy)).toEqual({
      ok: true,
      values: [-10, -10],
    });
    expect(constrainValuesRequest([110, 120], 1, 50, policy)).toEqual({
      ok: true,
      values: [110, 110],
    });
  });

  it('rejects a gap violation instead of sliding to the gap edge or pushing', () => {
    const input = [10, 20, 30];
    expect(
      constrainValuesRequest(input, 0, 19, {
        ...policy,
        minStepsBetweenValues: 2,
      })
    ).toEqual({ ok: false, reason: 'minimum-distance' });
    expect(input).toEqual([10, 20, 30]);
  });

  it('validates the whole final vector, including untouched invalid owner gaps', () => {
    expect(
      constrainValuesRequest([10, 10, 50], 2, 51, {
        ...policy,
        minStepsBetweenValues: 1,
      })
    ).toEqual({ ok: false, reason: 'minimum-distance' });
    expect(
      constrainValuesRequest([10, 10, 50], 0, 9, {
        ...policy,
        minStepsBetweenValues: 1,
      })
    ).toEqual({ ok: true, values: [9, 10, 50] });
  });

  it('uses Number distance without an epsilon or implicit decimal oracle', () => {
    expect(
      constrainValuesRequest([0.1, 0.3], 1, 0.3, {
        min: 0,
        max: 1,
        step: 0.2,
        minStepsBetweenValues: 1,
      })
    ).toEqual({ ok: false, reason: 'minimum-distance' });
  });

  it.each([-1, 0.5, 3, NaN, Infinity])('rejects invalid request index %s', (index) => {
    expect(constrainValuesRequest([10, 20, 30], index, 25, policy)).toEqual({
      ok: false,
      reason: 'invalid-index',
    });
  });

  it('rejects empty, unordered and hostile request vectors without side effects', () => {
    expect(constrainValuesRequest([], 0, 10, policy)).toEqual({
      ok: false,
      reason: 'invalid-index',
    });
    expect(constrainValuesRequest([20, 10], 0, 10, policy)).toEqual({
      ok: false,
      reason: 'unordered-values',
    });
    const getter = vi.fn(() => 10);
    const values = [10];
    Object.defineProperty(values, '0', { get: getter });
    expect(constrainValuesRequest(values, 0, 20, policy)).toMatchObject({
      ok: false,
    });
    expect(getter).not.toHaveBeenCalled();
  });

  it('diagnoses nonfinite inputs and unsupported finite-span subtraction', () => {
    expect(constrainValuesRequest([10], 0, Infinity, policy)).toEqual({
      ok: false,
      reason: 'nonfinite-request',
    });
    expect(
      constrainValuesRequest([-Number.MAX_VALUE, Number.MAX_VALUE], 0, -Number.MAX_VALUE, {
        min: -Number.MAX_VALUE,
        max: Number.MAX_VALUE,
        step: 1,
      })
    ).toEqual({ ok: false, reason: 'nonfinite-intermediate' });
  });
});

describe('Slider keyboard numeric intent', () => {
  it('rounds the current value relative to min before incrementing', () => {
    expect(
      sliderValuesKeyboard([0.36], 0, 'ArrowUp', {
        min: 0.05,
        max: 1,
        step: 0.1,
      })
    ).toBe(0.45);
    expect(
      sliderValuesKeyboard([0.36], 0, 'ArrowDown', {
        min: 0.05,
        max: 1,
        step: 0.1,
      })
    ).toBe(0.25);
    expect(sliderValuesKeyboard([0.05], 0, 'ArrowUp', { min: 0, max: 1, step: 0.1 })).toBe(0.2);
  });

  it.each([
    ['ArrowUp', 'ltr', 51],
    ['ArrowUp', 'rtl', 51],
    ['ArrowDown', 'ltr', 49],
    ['ArrowDown', 'rtl', 49],
    ['ArrowRight', 'ltr', 51],
    ['ArrowRight', 'rtl', 49],
    ['ArrowLeft', 'ltr', 49],
    ['ArrowLeft', 'rtl', 51],
    ['PageUp', 'rtl', 60],
    ['PageDown', 'rtl', 40],
  ] as const)('%s/%s preserves logical keyboard direction', (key, direction, expected) => {
    expect(sliderValuesKeyboard([50], 0, key, policy, direction)).toBe(expected);
  });

  it('uses an absolute default largeStep of ten, not step times ten', () => {
    const byThree = { ...policy, step: 3 };
    expect(sliderValuesKeyboard([10], 0, 'PageUp', byThree)).toBe(19);
    expect(sliderValuesKeyboard([10], 0, 'ArrowUp', byThree, 'ltr', true)).toBe(19);
    expect(
      sliderValuesKeyboard([10], 0, 'ArrowLeft', { ...byThree, largeStep: 7 }, 'rtl', true)
    ).toBe(16);
    expect(sliderValuesKeyboard([10], 0, 'PageUp', { ...policy, largeStep: 0 })).toBe(10);
  });

  it('cleans increment decimal places before root-bounding arrow/page results', () => {
    const decimal = { min: 0, max: 0.35, step: 0.1, largeStep: 0.2 };
    expect(sliderValuesKeyboard([0.2], 0, 'ArrowUp', decimal)).toBe(0.3);
    expect(sliderValuesKeyboard([0.2], 0, 'PageUp', decimal)).toBe(0.35);
    expect(sliderValuesKeyboard([0], 0, 'ArrowDown', decimal)).toBe(0);
  });

  it('Home/End keep exact endpoints and neighbor +/- fractional step gaps', () => {
    const min = -1.2345678901234567;
    const max = 1.2345678901234567;
    const exact = { min, max, step: 0.1, minStepsBetweenValues: 0.5 };
    expect(sliderValuesKeyboard([0], 0, 'Home', exact)).toBe(min);
    expect(sliderValuesKeyboard([0], 0, 'End', exact)).toBe(max);
    expect(sliderValuesKeyboard([0, 0.5, 1], 1, 'Home', exact)).toBe(0.05);
    expect(sliderValuesKeyboard([0, 0.5, 1], 1, 'End', exact)).toBe(0.95);
  });

  it('does not apply arrow decimal cleanup to Home/End neighbor arithmetic', () => {
    const decimal = { min: 0, max: 1, step: 0.2, minStepsBetweenValues: 1 };
    expect(sliderValuesKeyboard([0.1, 0.5], 1, 'Home', decimal)).toBe(0.30000000000000004);
  });

  it('does not gap-clamp arrows: Root subsequently rejects the proposal', () => {
    const spaced = { ...policy, minStepsBetweenValues: 2 };
    const candidate = sliderValuesKeyboard([18, 20], 0, 'ArrowUp', spaced);
    expect(candidate).toBe(19);
    expect(constrainValuesRequest([18, 20], 0, candidate!, spaced)).toEqual({
      ok: false,
      reason: 'minimum-distance',
    });
  });

  it('preserves direct Home/End for precision beyond the arithmetic scope', () => {
    const tiny = { min: 0, max: 1.2345678901234567, step: Number.MIN_VALUE };
    const diagnostic = vi.fn();
    expect(sliderValuesKeyboard([0], 0, 'ArrowUp', tiny, 'ltr', false, diagnostic)).toBeNull();
    expect(diagnostic).toHaveBeenCalledWith('unsupported-rounding-precision');
    expect(sliderValuesKeyboard([0], 0, 'Home', tiny)).toBe(0);
    expect(sliderValuesKeyboard([0], 0, 'End', tiny)).toBe(tiny.max);
  });

  it.each([
    [[Number.MAX_VALUE], { min: -Number.MAX_VALUE, max: Number.MAX_VALUE, step: 1 }],
    [[1], { min: 0, max: 100, step: Number.MIN_VALUE }],
    [[Number.MAX_VALUE], { min: 0, max: Number.MAX_VALUE, step: Number.MAX_VALUE }],
  ])('diagnoses nonfinite intermediate arithmetic', (values, bounds) => {
    const diagnostic = vi.fn();
    expect(
      sliderValuesKeyboard(
        values as number[],
        0,
        'ArrowUp',
        bounds as SliderValuesPolicy,
        'ltr',
        false,
        diagnostic
      )
    ).toBeNull();
    expect(diagnostic).toHaveBeenCalledWith('nonfinite-intermediate');
  });

  it('diagnoses invalid values/index/policy, while unrelated keys stay silent', () => {
    const diagnostic = vi.fn();
    expect(sliderValuesKeyboard([], 0, 'Home', policy, 'ltr', false, diagnostic)).toBeNull();
    expect(diagnostic).toHaveBeenLastCalledWith('invalid-index');
    expect(
      sliderValuesKeyboard([10], 0, 'ArrowUp', { ...policy, step: 0 }, 'ltr', false, diagnostic)
    ).toBeNull();
    expect(diagnostic).toHaveBeenLastCalledWith('invalid-step');
    diagnostic.mockClear();
    expect(sliderValuesKeyboard([], 0, 'Tab', policy, 'ltr', false, diagnostic)).toBeNull();
    expect(diagnostic).not.toHaveBeenCalled();
  });

  it('supports repeated owner-writeback without changing shape or other values', () => {
    const bounds = { min: 0, max: 1, step: 0.1 };
    let accepted = [0.3, 0.7];
    for (const key of ['ArrowUp', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'ArrowDown']) {
      const candidate = sliderValuesKeyboard(accepted, 0, key, bounds);
      expect(candidate).not.toBeNull();
      const result = constrainValuesRequest(accepted, 0, candidate!, bounds);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.reason);
      const owner = normalizeValuesOwner(result.values, bounds.min, bounds.max);
      expect(owner).toEqual({
        ok: true,
        rawValues: result.values,
        values: result.values,
        shape: 'array',
        reordered: false,
      });
      expect(result.values[1]).toBe(0.7);
      expect(result.values.every(Number.isFinite)).toBe(true);
      accepted = result.values;
    }
  });
});
