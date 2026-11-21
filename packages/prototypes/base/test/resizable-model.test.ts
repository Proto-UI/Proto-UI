// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  normalizeResizableSizes,
  resizableConstraints,
  type ResizableConstraint,
  type ResizablePanelConstraint,
} from '../src/resizable/model';

function assertLayout(layout: readonly number[], constraints: readonly ResizableConstraint[]) {
  expect(layout.length).toBe(constraints.length);
  expect(Object.isFrozen(layout)).toBe(true);
  expect(layout.reduce((sum, size) => sum + size, 0)).toBeCloseTo(100, 8);
  for (let i = 0; i < layout.length; i++) {
    expect(Object.hasOwn(layout, i)).toBe(true);
    const size = layout[i],
      constraint = constraints[i];
    expect(Number.isFinite(size)).toBe(true);
    expect(size).toBeGreaterThanOrEqual(0);
    expect(
      (constraint.collapsible && Math.abs(size - constraint.collapsedSize) < 1e-7) ||
        (size >= constraint.min - 1e-7 && size <= constraint.max + 1e-7)
    ).toBe(true);
  }
}

// Independent finite oracle: each collapsed/expanded assignment is a product
// of intervals, whose sum contains 100 exactly when its two bounds enclose it.
function feasible(constraints: readonly ResizableConstraint[]) {
  const toggles = constraints.flatMap((constraint, index) =>
    constraint.collapsible ? [index] : []
  );
  for (let mask = 0; mask < 2 ** toggles.length; mask++) {
    let low = 0,
      high = 0;
    for (let i = 0; i < constraints.length; i++) {
      const toggle = toggles.indexOf(i),
        constraint = constraints[i];
      if (toggle >= 0 && (mask & (1 << toggle)) !== 0) {
        low += constraint.collapsedSize;
        high += constraint.collapsedSize;
      } else {
        low += constraint.min;
        high += constraint.max;
      }
    }
    if (low <= 100 && high >= 100) return true;
  }
  return false;
}

describe('complete resizable vectors and constraints', () => {
  it('rejects a sparse percentage vector instead of returning a partial snapshot', () => {
    const input = new Array<number>(3);
    input[0] = 50;
    input[2] = 50;
    expect(normalizeResizableSizes(input, resizableConstraints(3)!)).toBeNull();
    expect(Object.hasOwn(input, 1)).toBe(false);
  });

  it('rejects a sparse constraint list rather than silently inventing an interior constraint', () => {
    const input = new Array<ResizablePanelConstraint>(3);
    input[0] = {};
    input[2] = {};
    expect(resizableConstraints(3, input)).toBeNull();
  });

  it.each([
    null,
    undefined,
    [],
    false,
    2,
    'panel',
    { min: null },
    { max: null },
    { collapsedSize: null },
    { collapsible: 'false' },
    { collapsible: 1 },
    { min: NaN },
    { max: Infinity },
    { collapsedSize: -1 },
    { min: 50, max: 40 },
    { min: 10, collapsedSize: 20 },
  ])('rejects malformed constraint %j', (input) => {
    expect(resizableConstraints(2, [input] as any)).toBeNull();
  });

  it('keeps omitted trailing constraints and omitted fields as documented defaults', () => {
    expect(resizableConstraints(3, [{ min: 10 }])).toEqual([
      { min: 10, max: 100, collapsible: false, collapsedSize: 0 },
      { min: 0, max: 100, collapsible: false, collapsedSize: 0 },
      { min: 0, max: 100, collapsible: false, collapsedSize: 0 },
    ]);
  });

  it('rejects malformed normalized constraints without throwing', () => {
    const c = resizableConstraints(2)!;
    for (const invalid of [null, {}, [c[0]], [c[0], undefined], [c[0], {}]]) {
      expect(() => normalizeResizableSizes([50, 50], invalid as any)).not.toThrow();
      expect(normalizeResizableSizes([50, 50], invalid as any)).toBeNull();
    }
  });

  it('returns a fresh dense immutable snapshot without changing its inputs', () => {
    const input = [1, 2, 7];
    const c = resizableConstraints(3, [{ min: 20, max: 60 }, { min: 10, max: 40 }, {}])!;
    const before = JSON.stringify(c);
    const first = normalizeResizableSizes(input, c)!;
    const second = normalizeResizableSizes(input, c)!;
    expect(first).toEqual([20, 15, 65]);
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    expect(first).not.toBe(input);
    expect(input).toEqual([1, 2, 7]);
    expect(JSON.stringify(c)).toBe(before);
    assertLayout(first, c);
  });
});

describe('feasible collapsed and expanded group projection', () => {
  it('preserves a feasible preferred collapsed topology', () => {
    const c = resizableConstraints(2, [{ min: 20, collapsible: true }])!;
    expect(normalizeResizableSizes([0, 100], c)).toEqual([0, 100]);
  });

  it('expands a preferred collapsed panel when the remaining capacity cannot reach 100', () => {
    const c = resizableConstraints(2, [{ min: 20, collapsible: true }, { max: 90 }])!;
    expect(normalizeResizableSizes([0, 100], c)).toEqual([20, 80]);
  });

  it('collapses a preferred expanded panel when all expanded minima exceed 100', () => {
    const c = resizableConstraints(2, [
      { min: 60, collapsible: true },
      { min: 60, collapsible: true },
    ])!;
    const layout = normalizeResizableSizes([50, 50], c)!;
    expect(layout).not.toBeNull();
    expect(layout.filter((value) => value === 0)).toHaveLength(1);
    assertLayout(layout, c);
  });

  it('can expand more than one preferred collapsed panel', () => {
    const c = resizableConstraints(3, [
      { min: 20, max: 30, collapsible: true },
      { min: 20, max: 30, collapsible: true },
      { max: 50 },
    ])!;
    expect(normalizeResizableSizes([0, 0, 100], c)).toEqual([25, 25, 50]);
  });

  it('keeps nonzero collapsed stops discrete while recovering a feasible expansion', () => {
    const c = resizableConstraints(2, [
      { min: 40, max: 60, collapsible: true, collapsedSize: 10 },
      { min: 20, max: 70 },
    ])!;
    expect(normalizeResizableSizes([0, 100], c)).toEqual([40, 60]);
  });

  it('handles a collapsed stop coinciding with the expanded minimum', () => {
    const c = resizableConstraints(2, [
      { min: 20, max: 50, collapsible: true, collapsedSize: 20 },
      { max: 60 },
    ])!;
    expect(normalizeResizableSizes([0, 100], c)).toEqual([40, 60]);
  });

  it.each([
    [{ min: 60 }, { min: 60 }],
    [{ max: 40 }, { max: 50 }],
    [
      { min: 60, max: 60, collapsible: true },
      { min: 60, max: 60, collapsible: true },
    ],
    [
      { min: 60, max: 70, collapsible: true },
      { min: 60, max: 70, collapsible: true },
      { min: 60, max: 70, collapsible: true },
    ],
  ])('rejects a genuinely infeasible group %j', (...constraints) => {
    const c = resizableConstraints(constraints.length, constraints)!;
    expect(
      normalizeResizableSizes(
        constraints.map(() => 1),
        c
      )
    ).toBeNull();
  });

  it.each(Array.from({ length: 11 }, (_, index) => index + 2))(
    'agrees with exhaustive topology feasibility for %i panels',
    (count) => {
      let seed = count * 12347;
      const random = (limit: number) => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed % limit;
      };
      for (let example = 0; example < 24; example++) {
        const collapsedCount = Math.floor(count / 3);
        const witnessSize = 100 / (count - collapsedCount);
        const c = resizableConstraints(
          count,
          Array.from({ length: count }, () => {
            // Alternate arbitrary configurations with a known feasible layout
            // so every panel count includes successful projection cases.
            if (example % 2 === 0)
              return {
                min: witnessSize * (0.7 + random(20) / 100),
                max: Math.min(100, witnessSize * (1 + random(40) / 100)),
                collapsible: true,
                collapsedSize: 0,
              };
            const min = random(45),
              max = min + random(101 - min);
            return {
              min,
              max,
              collapsible: random(3) !== 0,
              collapsedSize: random(min + 1),
            };
          })
        )!;
        const possible = feasible(c);
        if (example % 2 === 0) {
          expect(possible).toBe(true);
          // The witness is independent of the input weights being projected.
          const witness = Array.from({ length: count }, (_, index) =>
            index < collapsedCount ? 0 : witnessSize
          );
          assertLayout(Object.freeze(witness), c);
        }
        const inputs = [
          Array.from({ length: count }, () => 1),
          Array.from({ length: count }, (_, index) => (index === count - 1 ? 100 : 0)),
          Array.from({ length: count }, () => random(100) + 1),
        ];
        for (const input of inputs) {
          const layout = normalizeResizableSizes(input, c);
          expect(layout !== null).toBe(possible);
          if (layout) assertLayout(layout, c);
        }
      }
    }
  );
});
