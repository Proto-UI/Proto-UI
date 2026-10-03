/** Pure assertion input, shared by real browser measurements and Node mutation
 * controls. This is test evidence code, not a website interaction protocol. */
export type LinkRect = { left: number; top: number; right: number; bottom: number };
export type NativeLinkExpectation = {
  href: string | null;
  name: string | null;
  target: string | null;
  rel: string | null;
};
export type NativeLinkMeasurement = NativeLinkExpectation & {
  tag: string;
  role: string | null;
  nestedFocus: number;
  centerHitIsAnchor: boolean;
  cornerHitIsAnchor: boolean;
  anchorRect: LinkRect;
  surfaceRect: LinkRect;
};

export function nativeLinkEvidenceIssues(
  actual: NativeLinkMeasurement,
  expected: NativeLinkExpectation
): string[] {
  const issues: string[] = [];
  if (actual.tag !== 'A') issues.push('native anchor tag');
  if (actual.role !== null) issues.push('unexpected role');
  if (!actual.href || actual.href !== expected.href) issues.push('href mismatch');
  if (!actual.name?.trim() || actual.name !== expected.name) issues.push('name mismatch');
  if (actual.target !== expected.target) issues.push('target mismatch');
  if (actual.rel !== expected.rel) issues.push('rel mismatch');
  if (actual.nestedFocus !== 0) issues.push('nested focus owner');
  if (!actual.centerHitIsAnchor || !actual.cornerHitIsAnchor)
    issues.push('native anchor must be exact hit target');
  const a = actual.anchorRect;
  const v = actual.surfaceRect;
  const finite = [...Object.values(a), ...Object.values(v)].every(Number.isFinite);
  const contains =
    finite &&
    v.right > v.left &&
    v.bottom > v.top &&
    a.left <= v.left + 0.5 &&
    a.top <= v.top + 0.5 &&
    a.right >= v.right - 0.5 &&
    a.bottom >= v.bottom - 0.5;
  if (!contains) issues.push('visual outside native hit box');
  return issues;
}
