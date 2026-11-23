import { describe, expect, it } from 'vitest';
import { styleTintSourceTone, type StyleTintSourceTone } from '../src/material/style-tint-source';

const rgba = (colors: readonly (readonly number[])[]) =>
  Uint8Array.from(colors.flatMap((rgb) => [...rgb, 255]));
const gray = (codes: number[]) => rgba(codes.map((code) => [code, code, code]));

// Independent piecewise interpolation oracle for the definition. This does not
// execute GLSL or certify accumulated highp/mediump arithmetic and sRGB8 output.
function interpolate(tone: number, [low, range, boost]: StyleTintSourceTone) {
  const outside = 1 - boost * range;
  const knots = [
    [0, 0],
    [low, outside * low],
    [low + range, outside * (low + range) + boost * range],
    [1, 1],
  ];
  for (let at = 1; at < knots.length; at++) {
    const [x, y] = knots[at - 1],
      [nextX, nextY] = knots[at];
    if (nextX > x && tone <= nextX) return y + ((tone - x) * (nextY - y)) / (nextX - x);
  }
  return 1;
}

describe('profile 6 source tone budget: arithmetic and ownership facts, no GPU claim', () => {
  it('uses independent channel extrema and reserves all existing contact/static lighting', () => {
    const bytes = rgba([
      [20, 180, 60],
      [170, 50, 220],
      [80, 110, 120],
    ]);
    const original = bytes.slice();
    const [low, range, boost, reserved] = styleTintSourceTone(bytes);
    // Min/max channels deliberately come from different physical pixels.
    expect(low).toBe(Math.fround((20 * 0.2126 + 50 * 0.7152 + 60 * 0.0722 - 1) / 255));
    const upper = Math.min(1, (170 * 0.2126 + 180 * 0.7152 + 220 * 0.0722 + 1) / 255 + 0.21);
    expect(low + range).toBeLessThanOrEqual(upper);
    expect(upper - low - range).toBeLessThan(2 ** -24);
    expect(boost).toBeGreaterThanOrEqual(0.5);
    expect(boost).toBeLessThanOrEqual(1);
    expect(reserved).toBe(0);
    expect(bytes).toEqual(original);
    // Every independent per-channel source combination, plus either endpoint
    // of all existing lighting, lies within the source-owned work interval.
    for (const r of [20, 170])
      for (const g of [50, 180])
        for (const b of [60, 220])
          for (const light of [0, 0.035, 0.18, 0.21]) {
            const tone = [r, g, b].reduce(
              (sum, code, channel) =>
                sum + Math.min(1, code / 255 + light) * [0.2126, 0.7152, 0.0722][channel],
              0
            );
            expect(tone).toBeGreaterThanOrEqual(low);
            expect(tone).toBeLessThanOrEqual(low + range + 1e-14);
          }
  });

  it('keeps positive full-domain slopes and endpoints for near-black, near-white and wide sources', () => {
    for (const first of [0, 1, 16, 64, 128, 192, 224, 254, 255])
      for (const last of [first, Math.round((first + 255) / 2), 255]) {
        const budget = styleTintSourceTone(gray([first, last]));
        const [, range, boost] = budget;
        const outside = 1 - boost * range;
        expect(budget.every(Number.isFinite)).toBe(true);
        expect(budget.every((value) => value === Math.fround(value))).toBe(true);
        expect(budget[0] + range).toBeLessThanOrEqual(1);
        expect(interpolate(0, budget)).toBe(0);
        expect(interpolate(1, budget)).toBeCloseTo(1, 14);
        expect(outside).toBeGreaterThanOrEqual(0.5 - 1e-14);
        expect(outside + boost).toBeLessThanOrEqual(1.5 + 1e-14);
        let previous = 0;
        for (let step = 1; step <= 4096; step++) {
          const value = interpolate(step / 4096, budget);
          const change = value - previous;
          expect(change).toBeGreaterThanOrEqual(0.5 / 4096 - 1e-14);
          expect(change).toBeLessThanOrEqual(1.5 / 4096 + 1e-14);
          previous = value;
        }
      }
  });

  it('keeps the full-domain transfer unchanged instead of normalizing its end regions', () => {
    const budget = styleTintSourceTone(gray([0, 255]));
    expect(budget).toEqual([0, 1, 0.5, 0]);
    for (let code = 0; code <= 255; code++)
      expect(interpolate(code / 255, budget)).toBeCloseTo(code / 255, 14);
  });

  it('retains brightness changes between constant-field source revisions', () => {
    // A range-normalized source would make all these constant fields identical.
    // The unchanged pre-map channel clamp may already saturate white + light;
    // test strict response only while the original postlighting tone changes.
    for (const light of [0, 0.035, 0.18, 0.21]) {
      let previous = -1,
        oldTone = -1;
      for (let code = 0; code <= 255; code++) {
        const input = Math.min(1, code / 255 + light);
        const budget = styleTintSourceTone(gray([code]));
        const output = interpolate(input, budget);
        expect(output).toBeGreaterThanOrEqual(previous - 1e-14);
        if (oldTone >= 0 && input > oldTone)
          expect(output - previous).toBeGreaterThanOrEqual((input - oldTone) * 0.5 - 1e-14);
        previous = output;
        oldTone = input;
      }
    }
  });

  it('retains the same finite budget under reorder and a real response to source brightness', () => {
    const first = gray([32, 64, 96, 48]);
    const reorder = gray([96, 32, 48, 64]);
    const brighter = gray([64, 96, 128, 80]);
    const a = styleTintSourceTone(first),
      b = styleTintSourceTone(brighter);
    expect(styleTintSourceTone(reorder)).toEqual(a);
    for (const code of [32, 48, 64, 96]) {
      const before = interpolate(code / 255 + 0.035, a);
      const after = interpolate((code + 32) / 255 + 0.035, b);
      expect(after - before).toBeGreaterThanOrEqual(0.5 * (32 / 255) - 1e-14);
    }
    expect(a).not.toEqual(b);
  });

  it('does not create a constant output interval where the historical mean-clamp control does', () => {
    const budget = styleTintSourceTone(gray([224, 254]));
    const values = Array.from({ length: 4097 }, (_, i) => interpolate(i / 4096, budget));
    expect(values.slice(1).every((value, index) => value > values[index])).toBe(true);
    // Independent rejected research control from the retained historical case:
    // an uncompressed unit slope cannot fit the full input into a 0.428 interval.
    const rejected = Array.from({ length: 4097 }, (_, i) =>
      Math.max(0, Math.min(0.428108, 0.428108 * 0.5 + i / 4096 - 0.5))
    );
    expect(rejected.slice(1).some((value, index) => value === rejected[index])).toBe(true);
  });

  it('rejects malformed byte geometry and accepts an exact bounded subview', () => {
    for (const pixels of [new Uint8Array(), new Uint8Array(3), []])
      expect(() => styleTintSourceTone(pixels as Uint8Array)).toThrow('invalid-style-tint-source');
    const storage = Uint8Array.from([255, ...gray([32, 64]), 0]);
    expect(styleTintSourceTone(storage.subarray(1, 9))).toEqual(
      styleTintSourceTone(gray([32, 64]))
    );
  });
});
