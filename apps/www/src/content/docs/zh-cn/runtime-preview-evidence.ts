export type RuntimePreviewPaint = Readonly<{
  family: 'shadcn' | 'brutalist';
  surfaceCount: number;
  surfaceWidth: number;
  surfaceHeight: number;
  tokens: readonly string[];
  radius: readonly number[];
  expectedRadius: number;
  border: readonly number[];
  padding: readonly number[];
  expectedPadding: readonly number[];
  background: string;
  shadow: string;
  ancestorPaint: readonly string[];
  hasRole: boolean;
  hasTabStop: boolean;
  pointerEvents: string;
  contentContained: boolean;
  pageOverflow: number;
}>;

/** The browser and mutation fixtures share the actual acceptance predicate.
 * Tokens alone are insufficient: computed paint and geometry must also agree. */
export function runtimePreviewEvidenceIssues(facts: RuntimePreviewPaint): string[] {
  const issues: string[] = [];
  if (facts.surfaceCount !== 1) issues.push('one canvas surface required');
  if (
    ![facts.surfaceWidth, facts.surfaceHeight].every((value) => Number.isFinite(value) && value > 0)
  )
    issues.push('invalid canvas geometry');
  const radius = facts.expectedRadius;
  if (!(radius > 0)) issues.push('missing independent radius theme value');
  const border = facts.family === 'brutalist' ? 2 : 1;
  const radiusToken = facts.family === 'brutalist' ? 'rounded-base' : 'rounded-xl';
  if (!facts.tokens.includes(radiusToken)) issues.push('wrong family radius token');
  if (
    facts.radius.length !== 4 ||
    facts.radius.some((value) => !Number.isFinite(value) || Math.abs(value - radius) > 0.2)
  )
    issues.push('wrong computed family radius');
  if (
    facts.border.length !== 4 ||
    facts.border.some((value) => !Number.isFinite(value) || Math.abs(value - border) > 0.2)
  )
    issues.push('wrong computed family border');
  if (
    facts.padding.length !== 4 ||
    facts.expectedPadding.length !== 4 ||
    facts.padding.some(
      (value, index) =>
        !Number.isFinite(value) ||
        !Number.isFinite(facts.expectedPadding[index]) ||
        Math.abs(value - facts.expectedPadding[index]!) > 0.2
    )
  )
    issues.push('wrong canvas padding');
  if (facts.background === 'rgba(0, 0, 0, 0)' || facts.background === 'transparent')
    issues.push('missing canvas fill');
  // Canvas is the flat role; elevated card paint here would recreate nested depth.
  if (facts.shadow !== 'none') issues.push('canvas must remain flat');
  if (facts.ancestorPaint.length) issues.push('duplicate ancestor paint');
  if (facts.hasRole || facts.hasTabStop) issues.push('surface took semantic ownership');
  if (facts.pointerEvents === 'none') issues.push('surface blocks interactive slot');
  if (!facts.contentContained) issues.push('slot content exceeds canvas');
  if (!Number.isFinite(facts.pageOverflow) || facts.pageOverflow > 1)
    issues.push('page horizontal overflow');
  return issues;
}
