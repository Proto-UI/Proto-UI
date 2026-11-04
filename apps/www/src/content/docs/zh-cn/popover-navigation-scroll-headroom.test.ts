// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  MIN_NAVIGATION_DOWNWARD_ROOM,
  planNavigationWheel,
  navigationWheelProgress,
  planNavigationScrollHeadroom,
  type NavigationScrollHeadroom,
} from './popover-navigation-scroll-headroom';

const base: NavigationScrollHeadroom = {
  pageY: 808,
  documentHeight: 1708,
  viewportHeight: 900,
  triggerTop: 477,
  triggerBottom: 517,
};
describe('navigation scroll observation preparation', () => {
  it('retains the original end-of-page observation as non-discriminating', () => {
    const original = base.documentHeight - base.pageY - base.viewportHeight;
    expect(original).toBe(0);
    expect(() => expect(original).toBeGreaterThan(2)).toThrow();
    const plan = planNavigationScrollHeadroom(base);
    expect(plan).toEqual({ pageY: 744, upwardShift: 64, downwardRoom: 64 });
    expect(base.pageY).toBe(808);
  });
  it('also prepares the independent Brutalist historical page metrics', () => {
    const input = { ...base, pageY: 814, documentHeight: 1714 };
    expect(planNavigationScrollHeadroom(input)).toEqual({
      pageY: 750,
      upwardShift: 64,
      downwardRoom: 64,
    });
  });
  it('retains an already discriminating real-page position without movement', () => {
    expect(planNavigationScrollHeadroom({ ...base, pageY: 700 })).toEqual({
      pageY: 700,
      upwardShift: 0,
      downwardRoom: 108,
    });
  });
  it('does not accept exactly two pixels as sufficient room', () => {
    const plan = planNavigationScrollHeadroom({ ...base, pageY: 806 });
    expect(plan.upwardShift).toBe(62);
    expect(plan.downwardRoom).toBe(64);
  });
  it('bounds preparation by the Trigger viewport margin', () => {
    const plan = planNavigationScrollHeadroom({ ...base, triggerTop: 830, triggerBottom: 870 });
    expect(plan.upwardShift).toBe(14);
    expect(870 + plan.upwardShift).toBe(884);
    expect(plan.downwardRoom).toBeGreaterThan(2);
  });
  it('bounds preparation by the page owned upward scroll distance', () => {
    const plan = planNavigationScrollHeadroom({ ...base, pageY: 20, documentHeight: 920 });
    expect(plan.pageY).toBe(0);
    expect(plan.upwardShift).toBe(20);
  });
  for (const [name, input] of [
    ['non-scrollable document', { ...base, pageY: 0, documentHeight: 900 }],
    ['too little document scroll', { ...base, pageY: 2, documentHeight: 902 }],
    ['no safe Trigger movement', { ...base, triggerTop: 870, triggerBottom: 890 }],
    ['Trigger already outside viewport', { ...base, triggerTop: 880, triggerBottom: 920 }],
    ['Trigger above viewport', { ...base, triggerTop: -10 }],
    ['invalid Trigger geometry', { ...base, triggerBottom: base.triggerTop }],
    ['negative scroll', { ...base, pageY: -1 }],
    ['short document', { ...base, documentHeight: 899 }],
    ['invalid viewport', { ...base, viewportHeight: 0 }],
  ] as const) {
    it(`fails closed for ${name}, rather than fabricating headroom`, () => {
      expect(() => planNavigationScrollHeadroom(input)).toThrow();
    });
  }
  for (const key of Object.keys(base) as Array<keyof NavigationScrollHeadroom>) {
    it(`rejects non-finite ${key}`, () => {
      expect(() => planNavigationScrollHeadroom({ ...base, [key]: Number.NaN })).toThrow();
      expect(() => planNavigationScrollHeadroom({ ...base, [key]: Infinity })).toThrow();
    });
  }
  it('uses the original strict two-pixel precondition', () => {
    expect(MIN_NAVIGATION_DOWNWARD_ROOM).toBe(2);
  });
});

describe('reopened navigation wheel observation', () => {
  const bottom = { scrollTop: 1147, scrollHeight: 1600, clientHeight: 453 };
  it('measures upward progress from the retained bottom edge without resetting it', () => {
    const delta = planNavigationWheel(bottom);
    expect(delta).toBe(-340);
    expect(navigationWheelProgress(1147, 807, delta)).toBe(340);
    expect(bottom.scrollTop).toBe(1147);
  });
  it('rejects the retained-position no-op that the old scrollTop-only oracle accepted', () => {
    expect(bottom.scrollTop).toBeGreaterThan(0);
    const progress = navigationWheelProgress(
      bottom.scrollTop,
      bottom.scrollTop,
      planNavigationWheel(bottom)
    );
    expect(progress).toBe(0);
    expect(() => expect(progress).toBeGreaterThan(0)).toThrow();
  });
  it('chooses downward movement from the top and rejects the wrong direction', () => {
    const delta = planNavigationWheel({ ...bottom, scrollTop: 0 });
    expect(delta).toBe(340);
    expect(navigationWheelProgress(0, 340, delta)).toBe(340);
    expect(navigationWheelProgress(340, 0, delta)).toBeLessThan(0);
  });
  it('refuses a non-scrollable panel before making an observation claim', () => {
    expect(() =>
      planNavigationWheel({ scrollTop: 0, scrollHeight: 453, clientHeight: 453 })
    ).toThrow();
  });
  it('rejects invalid scroll positions and direction', () => {
    expect(() => planNavigationWheel({ ...bottom, scrollTop: 1200 })).toThrow();
    expect(() => planNavigationWheel({ ...bottom, scrollTop: -1 })).toThrow();
    expect(() => navigationWheelProgress(0, NaN, 340)).toThrow();
    expect(() => navigationWheelProgress(0, 340, 0)).toThrow();
  });
});
