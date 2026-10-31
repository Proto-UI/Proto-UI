// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  reduceScrollExpansion,
  solveTargetAlignment,
  type TargetAlignmentMetrics,
  type TargetAlignmentConstraints,
} from '../src/geometry/target-alignment';

// Authority: C-TARGET-ALIGNMENT-PLAN-0001 and its linked source/line/hash-bound equations.
// These are self-written function tests, not execution of Radix or browser geometry proof.
const constraints: TargetAlignmentConstraints = Object.freeze({
  boundary: 'layout-viewport',
  margin: 10,
  minimumTargetSpanCount: 5,
  inlineOverflow: 'preserve-start',
  expandOnScroll: true,
});
function metrics(): TargetAlignmentMetrics {
  return {
    direction: 'ltr',
    viewport: { width: 1000, height: 800 },
    reference: {
      left: 100,
      right: 260,
      width: 160,
      top: 300,
      height: 40,
      valueLeft: 112,
      valueRight: 240,
    },
    surface: {
      left: 0,
      right: 200,
      width: 200,
      clientHeight: 600,
      borderTop: 1,
      borderBottom: 1,
      paddingTop: 0,
      paddingBottom: 0,
    },
    target: { textLeft: 8, textRight: 188, offset: 150, height: 30, atStart: false, atEnd: false },
    scrollport: { scrollHeight: 600, offsetTop: 0, height: 600, paddingTop: 0, paddingBottom: 0 },
  };
}
function plan(m = metrics(), c = constraints) {
  const result = solveTargetAlignment(m, c);
  if (result.kind !== 'plan') throw new Error(result.reason);
  return result.plan;
}
function expansion(overrides: Partial<Parameters<typeof reduceScrollExpansion>[0]> = {}) {
  return reduceScrollExpansion({
    enabled: true,
    previousActualScroll: 156,
    actualScroll: 186,
    previousRequestedSpan: 446,
    minimumSpan: 150,
    availableSpan: 780,
    pin: 'start',
    ...overrides,
  });
}

describe('target alignment requested initial plans (fixed 2.2.6 source vectors)', () => {
  it('keeps initial surface alignment normal, with LTR min width156/left104 and target center320', () => {
    const p = plan();
    expect(p).toEqual({
      inline: { edge: 'left', inset: 104, minimumSpan: 156 },
      block: { pin: 'end', margin: 10, requestedSpan: 636, minimumSpan: 150, maximumSpan: 780 },
      contentAlignment: 'normal',
    });
    const initialFrameTop = 800 - 10 - p.block.requestedSpan;
    expect(initialFrameTop).toBe(154);
    expect(initialFrameTop + 166).toBe(320);
    // A premature flex-end would incorrectly move the natural602 surface34px.
    expect(initialFrameTop + (636 - 602) + 166).toBe(354);
    expect(Object.hasOwn(p, 'requestedScroll')).toBe(false);
  });
  it('retains logical right inset748 and min width152 for RTL', () => {
    expect(plan({ ...metrics(), direction: 'rtl' }).inline).toEqual({
      edge: 'right',
      inset: 748,
      minimumSpan: 152,
    });
  });
  it('allows ending overflow for an oversized1200 surface', () => {
    const m = metrics();
    const p = plan({ ...m, surface: { ...m.surface, width: 1200, right: 1200 } });
    expect(p.inline.inset).toBe(10);
    expect(p.inline.inset + 1200).toBeGreaterThan(m.viewport.width);
  });
  it('requests start pin446 and initial scroll156 for offset450', () => {
    const m = metrics();
    const p = plan({ ...m, target: { ...m.target, offset: 450 } });
    expect(p.block.requestedSpan).toBe(446);
    expect(p.block.pin).toBe('start');
    expect(p.requestedScroll).toBe(156);
    expect(p.contentAlignment).toBe('normal');
  });
  it('requests626 and2376 for a far target in3000px scroll content', () => {
    const m = metrics();
    const p = plan({
      ...m,
      target: { ...m.target, offset: 2670 },
      scrollport: { ...m.scrollport, scrollHeight: 3000 },
    });
    expect(p.block.requestedSpan).toBe(626);
    expect(p.requestedScroll).toBe(2376);
  });
  it('chooses end pin when before-target equals before-reference', () => {
    const m = metrics();
    const p = plan({ ...m, target: { ...m.target, offset: 294 } });
    expect(p.block.pin).toBe('end');
    expect(p.block.requestedSpan).toBe(780);
    expect(p.requestedScroll).toBeUndefined();
  });
  it('includes trailing padding only for the last collection record in end branch', () => {
    const m = metrics();
    const base = {
      ...m,
      reference: { ...m.reference, top: 775 },
      scrollport: { ...m.scrollport, paddingBottom: 20 },
    };
    expect(plan(base).block.requestedSpan).toBe(182);
    expect(plan({ ...base, target: { ...m.target, atEnd: true } }).block.requestedSpan).toBe(202);
  });
  it('includes leading padding only for the first collection record in start branch', () => {
    const m = metrics();
    const base = {
      ...m,
      reference: { ...m.reference, top: -10 },
      scrollport: { ...m.scrollport, paddingTop: 20 },
    };
    expect(plan(base).block.requestedSpan).toBe(452);
    expect(plan({ ...base, target: { ...m.target, atStart: true } }).block.requestedSpan).toBe(472);
  });
  it('does not hide source policy constants in the solver', () => {
    const p = plan(metrics(), { ...constraints, margin: 20, minimumTargetSpanCount: 2 });
    expect(p.block.margin).toBe(20);
    expect(p.block.minimumSpan).toBe(60);
    expect(p.block.maximumSpan).toBe(760);
    expect(p.block.requestedSpan).toBe(626);
  });
  it('preserves fractional facts, requiring source-normalization outside the function', () => {
    const m = metrics();
    const normalized = plan({ ...m, surface: { ...m.surface, borderTop: Math.trunc(1.9) } });
    expect(normalized.block.requestedSpan).toBe(636);
    expect(
      plan({ ...m, surface: { ...m.surface, borderTop: 1.9 } }).block.requestedSpan
    ).toBeCloseTo(636.9);
  });
  it('accepts zero text extent and zero Value extent when their edges are measurable', () => {
    const m = metrics();
    expect(
      solveTargetAlignment(
        {
          ...m,
          reference: { ...m.reference, valueRight: 112 },
          target: { ...m.target, textRight: 8 },
        },
        constraints
      ).kind
    ).toBe('plan');
  });
  it('preserves tiny positive viewport min>max and finite offscreen plans', () => {
    const m = metrics();
    const p = plan({ ...m, viewport: { ...m.viewport, height: 10 } });
    expect(p.block.minimumSpan).toBe(150);
    expect(p.block.maximumSpan).toBe(-10);
    expect(
      solveTargetAlignment({ ...m, reference: { ...m.reference, top: -1000 } }, constraints).kind
    ).toBe('plan');
  });
  it('never mutates input and freezes its own nested output', () => {
    const m = metrics();
    const before = JSON.stringify(m);
    const p = plan(m);
    expect(JSON.stringify(m)).toBe(before);
    expect(Object.isFrozen(p)).toBe(true);
    expect(Object.isFrozen(p.inline)).toBe(true);
    expect(Object.isFrozen(p.block)).toBe(true);
  });
  it.each([NaN, Infinity, -Infinity])('rejects nonfinite input %s without a plan', (value) => {
    const m = metrics();
    expect(
      solveTargetAlignment({ ...m, target: { ...m.target, offset: value } }, constraints)
    ).toEqual({ kind: 'invalid', reason: 'nonfinite-fact' });
  });
  it.each([0, -1])('rejects nonpositive row and viewport extent %s', (value) => {
    const m = metrics();
    expect(
      solveTargetAlignment({ ...m, target: { ...m.target, height: value } }, constraints).kind
    ).toBe('invalid');
    expect(
      solveTargetAlignment({ ...m, viewport: { ...m.viewport, width: value } }, constraints).kind
    ).toBe('invalid');
  });
  it('rejects negative dimensions/insets and invalid constraints', () => {
    const m = metrics();
    expect(
      solveTargetAlignment({ ...m, surface: { ...m.surface, paddingTop: -1 } }, constraints)
    ).toEqual({ kind: 'invalid', reason: 'invalid-extent' });
    expect(solveTargetAlignment(m, { ...constraints, minimumTargetSpanCount: 0 })).toEqual({
      kind: 'invalid',
      reason: 'invalid-constraint',
    });
  });
  it('rejects arithmetic overflow even when every input is finite', () => {
    const m = metrics();
    expect(
      solveTargetAlignment(
        {
          ...m,
          surface: { ...m.surface, borderTop: Number.MAX_VALUE, borderBottom: Number.MAX_VALUE },
        },
        constraints
      )
    ).toEqual({ kind: 'invalid', reason: 'nonfinite-plan' });
  });
});

describe('neutral scroll expansion requests', () => {
  it('expands446 to476 without recentering a start pin', () => {
    expect(expansion()).toEqual({
      kind: 'plan',
      plan: { nextPreviousActualScroll: 186, requestedSpan: 476 },
    });
  });
  it('caps end expansion760+30 at780, requests scroll10 and end alignment', () => {
    expect(expansion({ previousRequestedSpan: 760, pin: 'end' })).toEqual({
      kind: 'plan',
      plan: {
        nextPreviousActualScroll: 186,
        requestedSpan: 780,
        requestedScroll: 10,
        contentAlignment: 'end',
      },
    });
    // Host reads the applied/clamped actual scroll10; it is not inferred from a request.
    expect(
      expansion({
        previousActualScroll: 10,
        actualScroll: 10,
        previousRequestedSpan: 780,
        pin: 'end',
      })
    ).toEqual({ kind: 'plan', plan: { nextPreviousActualScroll: 10 } });
  });
  it.each([
    { enabled: false },
    { actualScroll: 156 },
    { previousRequestedSpan: 780 },
    { minimumSpan: 800 },
  ])('does not expand when %j', (override) => {
    const result = expansion(override);
    expect(result.kind).toBe('plan');
    if (result.kind === 'plan') expect(result.plan.requestedSpan).toBeUndefined();
  });
  it('requests zero scroll and end alignment for uncapped end expansion', () => {
    expect(expansion({ pin: 'end' })).toEqual({
      kind: 'plan',
      plan: {
        nextPreviousActualScroll: 186,
        requestedSpan: 476,
        requestedScroll: 0,
        contentAlignment: 'end',
      },
    });
  });
  it('handles decreasing scroll by magnitude and uses minimum as the previous span floor', () => {
    expect(expansion({ actualScroll: 126, previousRequestedSpan: 100 })).toEqual({
      kind: 'plan',
      plan: { nextPreviousActualScroll: 126, requestedSpan: 180 },
    });
  });
  it('rejects invalid facts without writes', () => {
    expect(expansion({ actualScroll: NaN })).toEqual({ kind: 'invalid', reason: 'nonfinite-fact' });
    expect(expansion({ previousActualScroll: -1 })).toEqual({
      kind: 'invalid',
      reason: 'invalid-extent',
    });
  });
  it('keeps negative derived available span from a tiny viewport as a no-op', () => {
    expect(expansion({ availableSpan: -10 })).toEqual({
      kind: 'plan',
      plan: { nextPreviousActualScroll: 186 },
    });
  });
});

describe('size-matched outer chrome constraints', () => {
  it.each(['ltr', 'rtl'] as const)('retains a192px row plus25px chrome in %s', (direction) => {
    const m = metrics();
    const result = plan({ ...m, direction, target: { ...m.target, minimumOuterInlineSpan: 217 } });
    expect(result.inline.minimumSpan).toBe(217);
    expect(result.inline.edge).toBe(direction === 'rtl' ? 'right' : 'left');
  });
  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid outer extent %s',
    (minimumOuterInlineSpan) => {
      const m = metrics();
      expect(
        solveTargetAlignment({ ...m, target: { ...m.target, minimumOuterInlineSpan } }, constraints)
          .kind
      ).toBe('invalid');
    }
  );
});
