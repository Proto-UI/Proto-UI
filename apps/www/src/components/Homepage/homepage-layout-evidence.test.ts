// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  chartContainmentIssues,
  galleryFlowEvidence,
  HOMEPAGE_GALLERY_IDS,
  type GalleryRect,
  type GalleryFlowFacts,
} from './homepage-layout-evidence';
const rect = (left: number, top: number, width: number, height = 100): GalleryRect => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
});
function fixture(
  width: number,
  viewportWidth: number,
  distribution: number[],
  gap = 32
): GalleryFlowFacts {
  const track = (width - gap * (distribution.length - 1)) / distribution.length;
  let index = 0;
  return {
    containerCount: 1,
    viewportWidth,
    rootFontSize: 16,
    columnGap: gap,
    container: rect(0, 0, width, 500),
    cards: distribution.flatMap((count, column) =>
      Array.from({ length: count }, (_, row) => {
        const bounds = rect(column * (track + gap), row * 120, track);
        return {
          id: HOMEPAGE_GALLERY_IDS[index++]!,
          visible: true,
          rect: bounds,
          rowGap: 20,
          fragments: [{ ...bounds }],
        };
      })
    ),
  };
}
describe('homepage evidence observers', () => {
  it('accepts five real columns at 2K+, four desktop columns and one mobile column', () => {
    for (const scene of [
      fixture(1664, 2048, [2, 2, 2, 2, 2]),
      fixture(1664, 2560, [2, 2, 2, 2, 2]),
      fixture(1320, 1440, [3, 3, 2, 2]),
      fixture(288, 320, [10], 24),
    ])
      expect(galleryFlowEvidence(scene).issues).toEqual([]);
  });
  it('rejects wrong order, split cards, overlapping cards and absent columns', () => {
    const scene = fixture(1664, 2048, [2, 2, 2, 2, 2]);
    const order = structuredClone(scene);
    order.cards.reverse();
    expect(galleryFlowEvidence(order).issues).toContain(
      'missing, duplicate or reordered gallery card'
    );
    const split = structuredClone(scene);
    split.cards[0]!.fragments.push(rect(0, 0, 200));
    expect(galleryFlowEvidence(split).issues).toContain(
      'controls: split or inconsistent gallery card fragment'
    );
    const overlap = structuredClone(scene);
    overlap.cards[1]!.rect = rect(0, 50, scene.cards[0]!.rect.width);
    overlap.cards[1]!.fragments = [overlap.cards[1]!.rect];
    expect(galleryFlowEvidence(overlap).issues).toContain(
      'controls/workspace-command: gallery cards overlap'
    );
    expect(galleryFlowEvidence(fixture(1664, 2048, [3, 3, 2, 2])).issues).toContain(
      'painted gallery column count differs from available 18rem tracks'
    );
  });
  it('rejects the old end-bar spill even when everything is inside the viewport', () => {
    const card = rect(400, 200, 308, 500);
    const parts = [
      rect(420, 250, 268, 300),
      rect(420, 300, 268, 176),
      ...Array.from({ length: 6 }, (_, index) => rect(430 + index * 42, 350, 28, 100)),
    ];
    expect(chartContainmentIssues(card, parts)).toEqual([]);
    const spill = structuredClone(parts);
    spill[2]!.left = 390;
    spill[2]!.right = 418;
    expect(chartContainmentIssues(card, spill)).toEqual([
      'analytics: media or bar escapes its card',
    ]);
    expect(chartContainmentIssues(card, parts.slice(1))).toEqual([
      'analytics: missing chart anatomy',
    ]);
  });
});
