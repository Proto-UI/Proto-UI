/** Passive geometry evidence only. Never writes to the rendered page. */
export const WIDE_GALLERY_COLUMNS = [
  ['controls', 'shortcuts', 'milestones'],
  ['workspace-analytics', 'workspace-command', 'ecosystem'],
  ['preferences', 'workspace-progress', 'protocol'],
  ['hover', 'editor', 'workspace-help', 'highlights'],
  ['overlays', 'spark', 'choices', 'throughput'],
] as const;
export const HOMEPAGE_GALLERY_IDS = WIDE_GALLERY_COLUMNS.flat();
const FOUR_GALLERY_COLUMNS = [
  ['controls', 'shortcuts', 'workspace-analytics', 'workspace-help'],
  ['milestones', 'workspace-command', 'ecosystem', 'highlights'],
  ['preferences', 'workspace-progress', 'protocol', 'hover'],
  ['editor', 'overlays', 'spark', 'choices', 'throughput'],
] as const;

export type GalleryRect = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
};
export type GalleryFlowFacts = {
  containerCount: number;
  viewportWidth: number;
  wideMedia: boolean;
  enhancedMedia: boolean;
  queryContainerWidth: number;
  readingFlowSupported: boolean;
  flowDisplay: string;
  flowReadingFlow: string;
  rootFontSize: number;
  columnGap: number;
  container: GalleryRect | null;
  cards: Array<{
    id: string | null;
    visible: boolean;
    rect: GalleryRect;
    rowGap: number;
    fragments: GalleryRect[];
  }>;
};
/** Physical columns in reading direction, with cards ordered from top to bottom. */
export function groupPaintedCards<T extends { rect: GalleryRect }>(cards: T[]) {
  const columns: T[][] = [];
  for (const card of cards) {
    const column = columns.find((group) => Math.abs(group[0]!.rect.left - card.rect.left) <= 1);
    if (column) column.push(card);
    else columns.push([card]);
  }
  columns.sort((a, b) => a[0]!.rect.left - b[0]!.rect.left);
  for (const column of columns) column.sort((a, b) => a.rect.top - b.rect.top);
  return columns;
}

/** All bounds are painted viewport coordinates, including in a zoomed overview. */
export function galleryHorizontalIssues(
  container: Pick<GalleryRect, 'left' | 'right'>,
  cards: GalleryFlowFacts['cards']
) {
  const issues: string[] = [];
  if (
    !Number.isFinite(container.left) ||
    !Number.isFinite(container.right) ||
    container.right <= container.left
  )
    return ['invalid gallery content bounds'];
  for (const card of cards) {
    if (
      [card.rect, ...card.fragments].some(
        (bounds) => !(bounds.left >= container.left - 1 && bounds.right <= container.right + 1)
      )
    )
      issues.push(`${card.id}: gallery card or fragment outside gallery content`);
  }
  if (
    Math.abs(Math.min(...cards.map((card) => card.rect.left)) - container.left) > 1 ||
    Math.abs(Math.max(...cards.map((card) => card.rect.right)) - container.right) > 1
  )
    issues.push('outer gallery columns differ from gallery content edges');
  return issues;
}

/** Pure geometry observer. One CSS pixel allows fractional layout rounding only. */
export function galleryFlowEvidence(facts: GalleryFlowFacts) {
  const issues: string[] = [];
  const epsilon = 1;
  // Tight 1.25rem rhythm on desktop and 1rem on compact viewports. Only one CSS
  // pixel of subpixel rounding is allowed.
  const expectedGap = facts.rootFontSize * (facts.viewportWidth <= 767 ? 1 : 1.25);
  if (facts.containerCount !== 1 || !facts.container)
    issues.push('expected exactly one gallery container');
  if (
    JSON.stringify(facts.cards.map((card) => card.id)) !== JSON.stringify(HOMEPAGE_GALLERY_IDS) ||
    new Set(facts.cards.map((card) => card.id)).size !== HOMEPAGE_GALLERY_IDS.length
  )
    issues.push('missing, duplicate or reordered gallery card');
  if (!Number.isFinite(expectedGap) || expectedGap <= 0)
    issues.push('invalid gallery spacing baseline');
  if (!Number.isFinite(facts.columnGap) || Math.abs(facts.columnGap - expectedGap) > epsilon)
    issues.push('gallery column gap differs from the responsive spacing contract');
  const columns: Array<{
    left: number;
    right: number;
    cards: GalleryFlowFacts['cards'];
    adjacentGaps: Array<{ before: string | null; after: string | null; gap: number }>;
  }> = groupPaintedCards(facts.cards).map((cards) => ({
    left: cards[0]!.rect.left,
    right: cards[0]!.rect.right,
    cards,
    adjacentGaps: [],
  }));
  for (const card of facts.cards) {
    const rect = card.rect;
    if (
      !card.visible ||
      !Object.values(rect).every(Number.isFinite) ||
      rect.width <= 0 ||
      rect.height <= 0
    )
      issues.push(`${card.id}: absent painted gallery card`);
    if (
      card.fragments.length !== 1 ||
      card.fragments.some(
        (fragment) =>
          !Object.values(fragment).every(Number.isFinite) ||
          fragment.width <= 0 ||
          fragment.height <= 0 ||
          Object.keys(rect).some(
            (key) =>
              Math.abs(fragment[key as keyof GalleryRect] - rect[key as keyof GalleryRect]) >
              epsilon
          )
      )
    )
      issues.push(`${card.id}: split or inconsistent gallery card fragment`);
    if (rect.left < -epsilon || rect.right > facts.viewportWidth + epsilon)
      issues.push(`${card.id}: gallery card outside viewport`);
  }
  for (const column of columns) {
    for (const card of column.cards)
      if (Math.abs(column.right - card.rect.right) > epsilon)
        issues.push(`${card.id}: inconsistent gallery column width`);
    if (facts.container && Math.abs(column.cards[0]!.rect.top - facts.container.top) > epsilon)
      issues.push(`${column.cards[0]!.id}: gallery column starts with a hole`);
    for (let index = 1; index < column.cards.length; index++) {
      const previous = column.cards[index - 1]!,
        current = column.cards[index]!;
      const gap = current.rect.top - previous.rect.bottom;
      column.adjacentGaps.push({ before: previous.id, after: current.id, gap });
      if (!Number.isFinite(previous.rowGap) || previous.rowGap <= 0)
        issues.push(`${previous.id}: invalid gallery row gap`);
      if (Math.abs(gap - previous.rowGap) > epsilon)
        issues.push(
          `${previous.id}/${current.id}: gallery gap differs from the responsive spacing contract`
        );
    }
  }
  if (!Number.isFinite(facts.queryContainerWidth) || facts.queryContainerWidth <= 0)
    issues.push('invalid gallery query container width');
  const enhancedExpected =
    facts.enhancedMedia &&
    facts.readingFlowSupported &&
    facts.queryContainerWidth >= 75.75 * facts.rootFontSize;
  const enhancedActive = facts.flowDisplay === 'flex' && facts.flowReadingFlow === 'flex-visual';
  if (enhancedExpected && !enhancedActive)
    issues.push('eligible gallery lacks its visual reading flow');
  const ordinaryReadingFlow = facts.flowReadingFlow === '' || facts.flowReadingFlow === 'normal';
  if (!enhancedExpected && (facts.flowDisplay !== 'contents' || !ordinaryReadingFlow))
    issues.push('ordinary gallery lacks its authored contents flow');
  if (enhancedExpected) {
    if (
      JSON.stringify(columns.map((column) => column.cards.map((card) => card.id))) !==
      JSON.stringify(FOUR_GALLERY_COLUMNS)
    )
      issues.push('painted four-column gallery differs from its authored reading order');
  } else if (
    JSON.stringify(columns.flatMap((column) => column.cards.map((card) => card.id))) !==
    JSON.stringify(facts.cards.map((card) => card.id))
  )
    issues.push('painted gallery column order differs from DOM order');
  for (let index = 0; index < facts.cards.length; index++)
    for (let other = index + 1; other < facts.cards.length; other++) {
      const a = facts.cards[index]!,
        b = facts.cards[other]!;
      if (
        Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left) > epsilon &&
        Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top) > epsilon
      )
        issues.push(`${a.id}/${b.id}: gallery cards overlap`);
    }
  const paintedColumns = columns.map((column) => ({
    left: column.left,
    right: column.right,
    ids: column.cards.map((card) => card.id),
    bottom: Math.max(...column.cards.map((card) => card.rect.bottom)),
    adjacentGaps: column.adjacentGaps,
  }));
  if (
    facts.wideMedia &&
    JSON.stringify(paintedColumns.map((column) => column.ids)) !==
      JSON.stringify(WIDE_GALLERY_COLUMNS)
  )
    issues.push('painted wide gallery columns differ from authored card groups');
  if (facts.container) {
    issues.push(...galleryHorizontalIssues(facts.container, facts.cards));
    if (columns.length) {
      const tails = columns.map((column) => column.cards.at(-1)!);
      const paintedBottom = Math.max(...tails.map((card) => card.rect.bottom));
      const marginBottom = Math.max(...tails.map((card) => card.rect.bottom + card.rowGap));
      if (facts.container.bottom < paintedBottom - epsilon)
        issues.push('gallery ends before its lowest painted card');
      if (facts.container.bottom > marginBottom + epsilon)
        issues.push('gallery continues below its final card margins');
    }
    const expectedColumns =
      facts.viewportWidth <= 639
        ? 1
        : facts.wideMedia
          ? 5
          : Math.max(
              1,
              Math.floor(
                (facts.container.width + expectedGap) / (18 * facts.rootFontSize + expectedGap)
              )
            );
    if (columns.length !== expectedColumns)
      issues.push('painted gallery column count differs from available 18rem tracks');
    if (facts.container.width > 116 * facts.rootFontSize + epsilon)
      issues.push('gallery exceeds the 116rem wide-screen limit');
    for (let index = 1; index < columns.length; index++)
      if (Math.abs(columns[index]!.left - columns[index - 1]!.right - expectedGap) > epsilon)
        issues.push('painted gallery column gap differs from the responsive spacing contract');
  }
  return {
    enhancedExpected,
    enhancedActive,
    issues: [...new Set(issues)],
    expectedGap,
    columns: paintedColumns,
    bottomSpread: paintedColumns.length
      ? Math.max(...paintedColumns.map((column) => column.bottom)) -
        Math.min(...paintedColumns.map((column) => column.bottom))
      : null,
  };
}

/** Card-relative geometry catches the old chart defect even inside the viewport. */
export function chartContainmentIssues(card: GalleryRect, parts: GalleryRect[]): string[] {
  if (parts.length !== 8) return ['analytics: missing chart anatomy'];
  return parts.some(
    (part) =>
      !Object.values(part).every(Number.isFinite) ||
      part.width <= 0 ||
      part.height <= 0 ||
      part.left < card.left - 1 ||
      part.right > card.right + 1 ||
      part.top < card.top - 1 ||
      part.bottom > card.bottom + 1
  )
    ? ['analytics: media or bar escapes its card']
    : [];
}
