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
    const missing = structuredClone(scene);
    missing.cards.pop();
    expect(galleryFlowEvidence(missing).issues).not.toEqual([]);
    const duplicate = structuredClone(scene);
    duplicate.cards[1]!.id = duplicate.cards[0]!.id;
    expect(galleryFlowEvidence(duplicate).issues).not.toEqual([]);
    const hidden = structuredClone(scene);
    hidden.cards[0]!.visible = false;
    expect(galleryFlowEvidence(hidden).issues).not.toEqual([]);
    const split = structuredClone(scene);
    split.cards[0]!.fragments.push(rect(0, 0, 200));
    expect(galleryFlowEvidence(split).issues).toContain(
      'controls: split or inconsistent gallery card fragment'
    );
    const noFragments = structuredClone(scene);
    noFragments.cards[0]!.fragments = [];
    expect(galleryFlowEvidence(noFragments).issues).not.toEqual([]);
    const reordered = structuredClone(scene);
    [reordered.cards[0]!.rect, reordered.cards[1]!.rect] = [
      reordered.cards[1]!.rect,
      reordered.cards[0]!.rect,
    ];
    for (const card of reordered.cards) card.fragments = [{ ...card.rect }];
    expect(galleryFlowEvidence(reordered).issues).toContain(
      'painted gallery column order differs from DOM order'
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
    const outside = fixture(288, 320, [10], 24);
    outside.cards[8]!.rect = rect(312, 0, 288);
    outside.cards[8]!.fragments = [{ ...outside.cards[8]!.rect }];
    expect(galleryFlowEvidence(outside).issues).toContain(
      'overlays: gallery card outside viewport'
    );
  });
  it('rejects extra spacing between adjacent cards while preserving reading order', () => {
    const scene = fixture(288, 320, [10], 24);
    expect(galleryFlowEvidence(scene).issues).toEqual([]);
    // Move the complete suffix together: order, fragments and adjacency remain
    // valid, so only the added space between the first two cards is rejected.
    for (const card of scene.cards.slice(1)) {
      card.rect.top += 80;
      card.rect.bottom += 80;
      card.fragments = [{ ...card.rect }];
    }
    expect(galleryFlowEvidence(scene).issues).not.toEqual([]);
    const columns = fixture(1664, 2048, [2, 2, 2, 2, 2]);
    columns.columnGap = 48;
    expect(galleryFlowEvidence(columns).issues).not.toEqual([]);
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
