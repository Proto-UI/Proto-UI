import { describe, expect, it } from 'vitest';
import {
  changedFirstFrameGeometry,
  type FirstFrameGeometry,
} from './quick-start-first-frame-geometry';
const first: FirstFrameGeometry = {
  header: { x: 16, y: 0, width: 358, height: 104 },
  title: { viewportX: 36, viewportY: 166, documentX: 36, documentY: 166 },
  scroll: { x: 0, y: 0 },
};
describe('first-frame absolute geometry guard', () => {
  it('rejects a whole-page jump even when every prose-relative box is identical', () => {
    const shifted = structuredClone(first);
    shifted.header.height = 56;
    shifted.title.viewportY -= 88;
    shifted.title.documentY -= 88;
    expect(changedFirstFrameGeometry(first, shifted)).toEqual([
      'header.height: 104 → 56',
      'title.viewportY: 166 → 78',
      'title.documentY: 166 → 78',
    ]);
  });
  it('rejects a viewport jump even when document positions remain stable', () => {
    const scrolled = structuredClone(first);
    scrolled.scroll.y = 10;
    scrolled.title.viewportY -= 10;
    expect(changedFirstFrameGeometry(first, scrolled)).toHaveLength(2);
  });
  it('does not accept missing or non-finite native measurements', () => {
    const next = structuredClone(first);
    next.title.documentY = Number.NaN;
    expect(changedFirstFrameGeometry(first, next)).toHaveLength(1);
  });
  it.each(['before', 'after'] as const)('rejects a missing field on the %s side', (side) => {
    const before = structuredClone(first),
      after = structuredClone(first);
    Reflect.deleteProperty((side === 'before' ? before : after).title, 'documentY');
    expect(changedFirstFrameGeometry(before, after)).toHaveLength(1);
  });
  it.each(['before', 'after'] as const)(
    'rejects an absent or empty group on the %s side',
    (side) => {
      const before = structuredClone(first),
        after = structuredClone(first);
      const incomplete = side === 'before' ? before : after;
      Reflect.deleteProperty(incomplete, 'header');
      expect(changedFirstFrameGeometry(before, after)).toHaveLength(4);
      Object.assign(incomplete, { header: {} });
      expect(changedFirstFrameGeometry(before, after)).toHaveLength(4);
    }
  );
  it('preserves the existing one-layout-pixel precision', () => {
    const next = structuredClone(first);
    next.header.height += 1;
    expect(changedFirstFrameGeometry(first, next)).toEqual([]);
    next.header.height += 0.01;
    expect(changedFirstFrameGeometry(first, next)).toHaveLength(1);
  });
});
