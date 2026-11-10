/** Passive geometry evidence only. Never writes to the rendered page. */
export const HOMEPAGE_GALLERY_IDS = [
  'controls',
  'workspace-command',
  'workspace-analytics',
  'workspace-progress',
  'preferences',
  'workspace-help',
  'editor',
  'hover',
  'overlays',
  'choices',
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
/** Pure geometry observer. One CSS pixel allows fractional layout rounding only. */
export function galleryFlowEvidence(facts: GalleryFlowFacts) {
  const issues: string[] = [];
  const epsilon = 1;
  // Differentiated axes: columns breathe more than stacked rows; compact cards
  // use a tighter authored rhythm. Only one CSS pixel of rounding is allowed.
  const expectedGap = facts.rootFontSize * (facts.viewportWidth <= 767 ? 1.5 : 2);
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
  }> = [];
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
    let column = columns.find((entry) => Math.abs(entry.left - rect.left) <= epsilon);
    if (!column) {
      column = { left: rect.left, right: rect.right, cards: [], adjacentGaps: [] };
      columns.push(column);
    }
    if (Math.abs(column.right - rect.right) > epsilon)
      issues.push(`${card.id}: inconsistent gallery column width`);
    column.cards.push(card);
  }
  columns.sort((a, b) => a.left - b.left);
  for (const column of columns) {
    column.cards.sort((a, b) => a.rect.top - b.rect.top);
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
  if (
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
  if (facts.container) {
    const expectedColumns =
      facts.viewportWidth <= 639
        ? 1
        : Math.max(
            1,
            Math.floor(
              (facts.container.width + expectedGap) / (18 * facts.rootFontSize + expectedGap)
            )
          );
    if (columns.length !== expectedColumns)
      issues.push('painted gallery column count differs from available 18rem tracks');
    if (facts.container.width > 104 * facts.rootFontSize + epsilon)
      issues.push('gallery exceeds the 104rem wide-screen limit');
    for (let index = 1; index < columns.length; index++)
      if (Math.abs(columns[index]!.left - columns[index - 1]!.right - expectedGap) > epsilon)
        issues.push('painted gallery column gap differs from the responsive spacing contract');
  }
  return {
    issues: [...new Set(issues)],
    expectedGap,
    columns: columns.map((column) => ({
      left: column.left,
      right: column.right,
      ids: column.cards.map((card) => card.id),
      adjacentGaps: column.adjacentGaps,
    })),
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
