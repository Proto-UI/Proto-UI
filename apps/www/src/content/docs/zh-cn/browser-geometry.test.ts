// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { documentRect, type ViewportGeometry } from './browser-geometry';

const before: ViewportGeometry = {
  viewportRect: { x: 44, y: 620, width: 212, height: 192 },
  scrollOffset: { x: 0, y: 80 },
};
const afterScroll: ViewportGeometry = {
  viewportRect: { x: 24, y: 133, width: 212, height: 192 },
  scrollOffset: { x: 20, y: 567 },
};

describe('document geometry measurement', () => {
  it('retains fractional movement for exact-equality geometry checks', () => {
    const moved: ViewportGeometry = {
      ...afterScroll,
      viewportRect: { ...afterScroll.viewportRect, y: afterScroll.viewportRect.y + 0.25 },
    };
    expect(documentRect(moved)).not.toEqual(documentRect(before));
    expect(documentRect(moved).y - documentRect(before).y).toBe(0.25);
  });
  it('retains absolute position and dimensions when the document has not scrolled', () => {
    expect(documentRect(before)).toEqual({ x: 44, y: 700, width: 212, height: 192 });
    expect(documentRect({ ...before, scrollOffset: { x: 0, y: 0 } })).toEqual(before.viewportRect);
  });

  it('does not mistake document scrolling for a focus-induced layout change', () => {
    expect(Math.abs(afterScroll.viewportRect.y - before.viewportRect.y)).toBe(487);
    expect(documentRect(afterScroll)).toEqual(documentRect(before));
  });

  it.each(['x', 'y', 'width', 'height'] as const)(
    'still exposes a real %s change above the existing 1px focus tolerance during scrolling',
    (property) => {
      const changed: ViewportGeometry = {
        ...afterScroll,
        viewportRect: {
          ...afterScroll.viewportRect,
          [property]: afterScroll.viewportRect[property] + 2,
        },
      };
      const delta = Math.abs(documentRect(changed)[property] - documentRect(before)[property]);
      expect(delta).toBe(2);
      expect(delta).toBeGreaterThan(1);
    }
  );
});
