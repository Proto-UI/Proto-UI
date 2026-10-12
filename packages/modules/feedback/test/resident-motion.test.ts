import { describe, it, expect } from 'vitest';
import { snapshotResidentMotion } from '@proto.ui/core';
import { createResidentMotionSampler } from '../src/motion/sampler';
import {
  extractResidentMotionTarget,
  resolveMotionTranslate,
  type MotionTranslate,
} from '../src/motion/targets';
const linear = { durationMs: 100, easing: [0, 0, 1, 1] as const };
describe('resident motion pure contract', () => {
  it('snapshots declarations and rejects nonfinite or duplicate input', () => {
    const d = { properties: ['translate'] as 'translate'[], ...linear };
    const s = snapshotResidentMotion(d);
    d.properties.length = 0;
    expect(s.properties).toEqual(['translate']);
    expect(() => snapshotResidentMotion({ ...s, durationMs: NaN })).toThrow();
    expect(() =>
      snapshotResidentMotion({ ...s, properties: ['translate', 'translate'] })
    ).toThrow();
  });
  it('initial target settles, unchanged target/controlled rejection does not restart', () => {
    const s = createResidentMotionSampler(linear);
    expect(s.target([0], 0)).toEqual([0]);
    expect(s.active).toBe(false);
    s.target([10], 10);
    expect(s.target([10], 60)![0]).toBeCloseTo(5);
    expect(s.sample(110)).toEqual([10]);
    expect(s.active).toBe(false);
  });
  it('rapid reversal preserves C0 and shortens duration including repeated reverse', () => {
    const s = createResidentMotionSampler(linear);
    s.target([0], 0);
    s.target([10], 0);
    const before = s.sample(40)!;
    expect(s.target([0], 40)![0]).toBeCloseTo(before[0]);
    expect(s.sample(60)![0]).toBeCloseTo(2);
    expect(s.target([10], 60)![0]).toBeCloseTo(2);
    expect(s.sample(100)![0]).toBeCloseTo(6);
    expect(s.sample(140)![0]).toBeCloseTo(10);
  });
  it('third targets reset duration without a presentation jump', () => {
    const s = createResidentMotionSampler(linear);
    s.target([0], 0);
    s.target([10], 0);
    expect(s.target([20], 50)![0]).toBeCloseTo(5);
    expect(s.sample(100)![0]).toBeCloseTo(12.5);
  });
  it('reduced/unknown or hidden settle and returning preference does not replay', () => {
    const s = createResidentMotionSampler(linear);
    s.target([0], 0);
    s.target([10], 0);
    expect(s.target([10], 30, false)).toEqual([10]);
    expect(s.target([10], 40, true)).toEqual([10]);
    expect(s.active).toBe(false);
  });
  it('dispose rejects late targets and samples', () => {
    const s = createResidentMotionSampler(linear);
    s.target([0], 0);
    s.target([10], 0);
    s.dispose();
    expect(s.sample(10)).toBe(null);
    expect(s.target([0], 20)).toBe(null);
  });
  it('rejects invalid values and time regressions', () => {
    const s = createResidentMotionSampler(linear);
    s.target([0], 10);
    expect(() => s.sample(9)).toThrow();
    expect(() => s.target([NaN], 20)).toThrow();
  });
  it('extracts affine translate and requires real units without parsing CSS', () => {
    const t = extractResidentMotionTarget(['translate-x-[calc(100%-2px)]'], 'translate');
    expect(t.supported).toBe(true);
    if (!t.supported) return;
    expect(
      resolveMotionTranslate(t.value as MotionTranslate, { rootFontPx: 16, width: 16, height: 16 })
    ).toEqual([14, 0]);
    expect(
      resolveMotionTranslate(t.value as MotionTranslate, { rootFontPx: 32, width: 30, height: 30 })
    ).toEqual([28, 0]);
    expect(
      resolveMotionTranslate(t.value as MotionTranslate, {
        rootFontPx: 16,
        width: null,
        height: 16,
      })
    ).toBe(null);
  });
  it('never silently overrides transform composition or selector targets', () => {
    expect(extractResidentMotionTarget(['translate-x-4', 'scale-95'], 'translate')).toEqual({
      supported: false,
      reason: 'transform-composition-unavailable',
    });
    expect(extractResidentMotionTarget(['data-[checked]:translate-x-4'], 'translate')).toEqual({
      supported: false,
      reason: 'selector-dependent-target',
    });
    expect(
      extractResidentMotionTarget(['bg-input', 'data-[checked]:bg-primary'], 'background-color')
        .supported
    ).toBe(false);
  });
  it('retains semantic palette identity and alpha', () => {
    expect(extractResidentMotionTarget(['bg-input/80'], 'background-color')).toEqual({
      supported: true,
      value: { role: 'input', alpha: 0.8 },
      ownedTokens: ['bg-input/80'],
    });
  });
});

it('rejects a second timing writer and negative transform composition', () => {
  expect(
    extractResidentMotionTarget(['translate-x-4', 'transition-transform'], 'translate')
  ).toEqual({ supported: false, reason: 'competing-timing-writer' });
  expect(extractResidentMotionTarget(['translate-x-4', '-rotate-45'], 'translate')).toEqual({
    supported: false,
    reason: 'transform-composition-unavailable',
  });
});

it('typed acknowledged interruption preserves displayed progress and default mathematical mode', () => {
  const s = createResidentMotionSampler(linear);
  s.target([0], 0);
  s.target([10], 0);
  const painted = s.sample(20)!;
  expect(s.target([0], 180, true, painted)).toEqual(painted);
  expect(s.sample(190)![0]).toBeCloseTo(1);
  expect(s.sample(200)).toEqual([0]);
  const defaultMode = createResidentMotionSampler(linear);
  defaultMode.target([0], 0);
  defaultMode.target([10], 0);
  expect(defaultMode.target([0], 80)![0]).toBeCloseTo(8, 12);
});
it('typed interruption anchors reject sparse/accessor/nonfinite coordinates without executing getters', () => {
  for (const bad of [new Array(1), [NaN], [Infinity]]) {
    const s = createResidentMotionSampler(linear);
    s.target([0], 0);
    s.target([10], 0);
    expect(() => s.target([0], 20, true, bad)).toThrow();
  }
  let reads = 0;
  const anchor = [2];
  Object.defineProperty(anchor, 0, {
    get() {
      reads++;
      return 2;
    },
  });
  const s = createResidentMotionSampler(linear);
  s.target([0], 0);
  s.target([10], 0);
  expect(() => s.target([0], 20, true, anchor)).toThrow();
  expect(reads).toBe(0);
});

it('dimension replacement settles and typed anchors are copied', () => {
  const s = createResidentMotionSampler(linear);
  s.target([0], 0);
  s.target([10], 0);
  const anchor = [2];
  expect(s.target([0], 80, true, anchor)).toEqual([2]);
  anchor[0] = 9;
  expect(s.sample(90)![0]).toBeCloseTo(1, 12);
  expect(s.target([1, 2], 95, true, [1])).toEqual([1, 2]);
  expect(s.active).toBe(false);
});
