import { describe, expect, it } from 'vitest';
import * as model from '../src/impl';

const resolve = (input: unknown, available = 1000, rootText = 16, natural = 120) =>
  (model as any).resolveAvailableExtent(input, available, rootText, natural);
const intent = (patch: Record<string, unknown> = {}) => ({
  edge: 'bottom',
  extent: 'intrinsic',
  fraction: 1,
  minimum: { unit: 'logical', value: 0 },
  maximum: { unit: 'available-minus-root-text', value: 6 },
  displacement: 0,
  ...patch,
});

describe('neutral constrained available extent model', () => {
  it('fits natural content and resolves the exact six-root-text cap at root16 and root32', () => {
    expect(resolve(intent())).toMatchObject({ extent: 120, cap: 904, minimum: 0 });
    expect(resolve(intent(), 1000, 32, 1000)).toMatchObject({ extent: 808, cap: 808 });
  });
  it('lets a safe cap win over a valid but larger minimum', () => {
    expect(resolve(intent({ minimum: { unit: 'logical', value: 1200 } }))).toMatchObject({
      extent: 904,
      cap: 904,
      minimum: 904,
    });
  });
  it('uses the cap as the named fraction denominator and ignores minimum in fraction mode', () => {
    expect(
      resolve(
        intent({ extent: 'fraction', fraction: 0.5, minimum: { unit: 'logical', value: 999 } })
      )
    ).toMatchObject({ extent: 452, cap: 904, minimum: 0 });
  });
  it.each([
    ['logical', 320, 320],
    ['root-text', 20, 320],
    ['available', 0.4, 400],
    ['available-minus-root-text', 6, 904],
  ])('resolves %s coefficients without hidden scaling', (unit, value, expected) => {
    expect(resolve(intent({ maximum: { unit, value } }), 1000, 16, 2000)?.cap).toBe(expected);
  });
  it.each([
    { maximum: { unit: 'logical', value: -1 } },
    { maximum: { unit: 'logical', value: NaN } },
    { maximum: { unit: 'available', value: 1.1 } },
    { maximum: { unit: 'unknown', value: 1 } },
    { minimum: { unit: 'logical', value: Infinity } },
    { fraction: -1 },
    { fraction: NaN },
    { displacement: Infinity },
    { displacement: -0.1 },
    { displacement: 1.1 },
    { edge: 'unknown' },
    { extent: 'unknown' },
  ])('rejects invalid extent intent %# without manufacturing a valid size', (patch) => {
    expect(resolve(intent(patch))).toBeNull();
  });
  it.each([NaN, -1, Infinity])('rejects unknown/invalid available extent %s', (available) => {
    expect(resolve(intent(), available)).toBeNull();
  });
  it('reports a mathematical zero cap without claiming that physical chrome fits', () => {
    expect(resolve(intent(), 80)).toMatchObject({ extent: 0, cap: 0 });
  });
  it('does not let displacement alter resting size', () => {
    expect(resolve(intent({ displacement: 0.75 }))).toMatchObject({ extent: 120, cap: 904 });
  });
});
