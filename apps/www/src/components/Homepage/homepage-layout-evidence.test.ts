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
  tracks: number | number[],
  measuredGap?: number
): GalleryFlowFacts {
  const gapRem =
    viewportWidth <= 767 ? 1 : viewportWidth < 1024 ? 2 : viewportWidth < 1900 ? 1.5 : 2.5;
  const gap = measuredGap ?? 16 * gapRem;
  const count = HOMEPAGE_GALLERY_IDS.length;
  const columnCount = typeof tracks === 'number' ? tracks : tracks.length;
  const distribution = Array.isArray(tracks)
    ? tracks
    : Array.from(
        { length: columnCount },
        (_, index) =>
          Math.floor(((index + 1) * count) / columnCount) -
          Math.floor((index * count) / columnCount)
      );
  const track = (width - gap * (columnCount - 1)) / columnCount;
  let index = 0;
  return {
    containerCount: 1,
    viewportWidth,
    gapRem,
    wideMedia: viewportWidth >= 1536,
    enhancedMedia: viewportWidth >= 768 && viewportWidth < 1536,
    queryContainerWidth: width,
    readingFlowSupported: true,
    flowDisplay: 'contents',
    flowReadingFlow: 'normal',
    rootFontSize: 16,
    columnGap: gap,
    container: rect(0, 0, width, Math.max(...distribution) * 120 - 20),
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
    const desktop = fixture(1320, 1440, [4, 4, 4, 5]);
    desktop.flowDisplay = 'flex';
    desktop.flowReadingFlow = 'flex-visual';
    const positions = desktop.cards.map((card) => ({ rect: card.rect, fragments: card.fragments }));
    const paintedOrder = [
      'controls',
      'shortcuts',
      'workspace-analytics',
      'workspace-help',
      'milestones',
      'workspace-command',
      'ecosystem',
      'highlights',
      'preferences',
      'workspace-progress',
      'protocol',
      'hover',
      'editor',
      'overlays',
      'spark',
      'choices',
      'throughput',
    ];
    paintedOrder.forEach((id, index) =>
      Object.assign(desktop.cards.find((card) => card.id === id)!, positions[index])
    );
    for (const scene of [
      fixture(1856, 2048, [3, 3, 3, 4, 4]),
      fixture(1856, 2560, [3, 3, 3, 4, 4]),
      desktop,
      fixture(288, 320, 1, 16),
    ])
      expect(galleryFlowEvidence(scene).issues).toEqual([]);
  });
  it('requires visual reading order when the viewport, container and feature queries apply', () => {
    const scene = fixture(1320, 1440, [4, 4, 4, 5]);
    scene.readingFlowSupported = false;
    scene.flowReadingFlow = '';
    expect(galleryFlowEvidence(scene).issues).toEqual([]);
    scene.readingFlowSupported = true;
    expect(galleryFlowEvidence(scene).issues).toContain(
      'eligible gallery lacks its visual reading flow'
    );
    scene.enhancedMedia = false;
    expect(galleryFlowEvidence(scene).issues).toEqual([]);
    const narrower = fixture(1200, 1440, 3);
    expect(galleryFlowEvidence(narrower).issues).toEqual([]);
  });
  it('uses wide media even with an enlarged document root', () => {
    const scene = fixture(1840, 1920, [3, 3, 3, 4, 4], 80);
    scene.rootFontSize = 32;
    expect(galleryFlowEvidence(scene).issues).toEqual([]);
  });
  it('detects a common translation inside the viewport but outside the centered gallery', () => {
    const scene = fixture(1320, 1440, 4);
    scene.readingFlowSupported = false;
    scene.container = rect(60, 0, 1320, scene.container!.height);
    for (const card of scene.cards) {
      card.rect.left += 60;
      card.rect.right += 60;
      card.fragments = [{ ...card.rect }];
    }
    expect(galleryFlowEvidence(scene).issues).toEqual([]);
    for (const card of scene.cards) {
      card.rect.left += 20;
      card.rect.right += 20;
      card.fragments = [{ ...card.rect }];
    }
    expect(galleryFlowEvidence(scene).issues).toContain(
      'outer gallery columns differ from gallery content edges'
    );
    expect(galleryFlowEvidence(scene).issues).toContain(
      'choices: gallery card or fragment outside gallery content'
    );
  });
  it('ends the gallery at the lowest card or its trailing margin', () => {
    const scene = fixture(1856, 2048, [3, 3, 3, 4, 4]);
    const bottom = scene.container!.bottom;
    const atHeight = (height: number) =>
      galleryFlowEvidence({ ...scene, container: rect(0, 0, 1856, height) }).issues;
    expect(atHeight(bottom)).toEqual([]);
    expect(atHeight(bottom + 20)).toEqual([]);
    expect(atHeight(bottom + 5122)).toEqual(['gallery continues below its final card margins']);
    expect(atHeight(bottom - 20)).toEqual(['gallery ends before its lowest painted card']);
  });
  it('rejects wrong order, split cards, overlapping cards and absent columns', () => {
    const scene = fixture(1856, 2048, [3, 3, 3, 4, 4]);
    expect(galleryFlowEvidence(scene).bottomSpread).toBe(120);
    // Shift a column break while keeping the full inventory and flattened order intact.
    expect(galleryFlowEvidence(fixture(1856, 2048, [3, 3, 4, 3, 4])).issues).toEqual([
      'painted wide gallery columns differ from authored card groups',
    ]);
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
      'controls/shortcuts: gallery cards overlap'
    );
    expect(galleryFlowEvidence(fixture(1856, 2048, 4)).issues).toContain(
      'painted gallery column count differs from available 18rem tracks'
    );
    const outside = fixture(288, 320, 1, 16);
    const overlay = outside.cards.find((card) => card.id === 'overlays')!;
    overlay.rect = rect(312, 0, 288);
    overlay.fragments = [{ ...overlay.rect }];
    expect(galleryFlowEvidence(outside).issues).toContain(
      'overlays: gallery card outside viewport'
    );
  });
  it('rejects extra spacing between adjacent cards while preserving reading order', () => {
    const scene = fixture(288, 320, 1, 16);
    expect(galleryFlowEvidence(scene).issues).toEqual([]);
    // Move the complete suffix together: order, fragments and adjacency remain
    // valid, so only the added space between the first two cards is rejected.
    for (const card of scene.cards.slice(1)) {
      card.rect.top += 80;
      card.rect.bottom += 80;
      card.fragments = [{ ...card.rect }];
    }
    expect(galleryFlowEvidence(scene).issues).not.toEqual([]);
    const columns = fixture(1856, 2048, [3, 3, 3, 4, 4]);
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
