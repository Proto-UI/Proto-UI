/** Pure locale evidence input for the governed native-anchor surfaces.
 *
 * Real browser measurements in `site-native-links.browser.test.ts` and the
 * mutation controls that must fail closed share these rules. This is test
 * evidence code, not a website interaction protocol.
 */
export type ShellLinkFact = {
  tag: string;
  name: string | null;
  href: string | null;
  target: string | null;
  rel: string | null;
  role: string | null;
  current: string | null;
  buttonCommand: boolean;
  visualOwner: boolean;
  nestedInteractive: number;
  hitIsAnchor: boolean;
};

export type ShellLinkExpectation = {
  name: string;
  href: string;
  target?: string | null;
  rel?: string | null;
};

/** Both configured locales are prefixed, so a shell destination is the authored
 * path behind the locale segment. The value is only ever compared with a
 * destination observed on that same locale's rendered page. */
export const localizedShellHref = (path: string, locale: 'en' | 'zh-cn'): string =>
  `/${locale}${path}`;

const linkIssues = (
  actual: ShellLinkFact,
  expected: ShellLinkExpectation,
  index: number,
  allowCurrent: boolean
): string[] => {
  const issues: string[] = [];
  if (actual.tag !== 'A') {
    issues.push(`${index}: native anchor tag`);
  }
  if (actual.role !== null) {
    issues.push(`${index}: unexpected role`);
  }
  if (actual.buttonCommand) {
    issues.push(`${index}: Button command marker`);
  }
  if (!actual.name?.trim() || actual.name !== expected.name) {
    issues.push(`${index}: accessible name mismatch`);
  }
  if (actual.href !== expected.href) {
    issues.push(`${index}: destination mismatch`);
  }
  if (expected.target !== undefined && actual.target !== expected.target) {
    issues.push(`${index}: target mismatch`);
  }
  if (expected.rel !== undefined && actual.rel !== expected.rel) {
    issues.push(`${index}: rel mismatch`);
  }
  if (!actual.visualOwner) {
    issues.push(`${index}: missing passive visual owner`);
  }
  if (actual.nestedInteractive !== 0) {
    issues.push(`${index}: nested focus owner`);
  }
  if (!actual.hitIsAnchor) {
    issues.push(`${index}: native anchor must be exact hit target`);
  }
  if (!allowCurrent && actual.current !== null) {
    issues.push(`${index}: unexpected current-route marker`);
  }
  return issues;
};

/** One navigation surface must expose exactly the authored rows in order, and
 * every row must stay a plain native anchor. A governed shell navigation never
 * owns the current-route marker; that truth belongs to the docs navigation. */
export function shellNavigationIssues(
  actual: ShellLinkFact[],
  expected: ShellLinkExpectation[],
  options: { currentAllowed?: boolean } = {}
): string[] {
  const issues: string[] = [];
  if (actual.length !== expected.length) {
    issues.push('anchor count');
  }
  for (const [index, expectation] of expected.entries()) {
    const observed = actual[index];
    if (!observed) continue;
    issues.push(...linkIssues(observed, expectation, index, options.currentAllowed ?? false));
  }
  return issues;
}

/** Content-authored actions (the hero group) own their words in the locale's
 * documentation entry. Their cross-locale contract is therefore a locale
 * substitution of the observed destination plus a genuinely localized name,
 * never a hand-written translation.
 */
export function localePairIssues(zh: ShellLinkFact[], en: ShellLinkFact[]): string[] {
  const issues: string[] = [];
  if (zh.length !== en.length) {
    issues.push('action count mismatch');
  }
  const names = new Set<string>();
  for (const [index, source] of zh.entries()) {
    const localized = en[index];
    if (!localized) continue;
    if (!localized.name?.trim()) {
      issues.push(`${index}: empty accessible name`);
    } else {
      if (localized.name === source.name) {
        issues.push(`${index}: untranslated accessible name`);
      }
      if (names.has(localized.name)) {
        issues.push(`${index}: duplicate accessible name`);
      }
      names.add(localized.name);
    }
    if (localized.role !== null) {
      issues.push(`${index}: unexpected role`);
    }
    if (localized.buttonCommand) {
      issues.push(`${index}: Button command marker`);
    }
    if (localized.tag !== 'A') {
      issues.push(`${index}: native anchor tag`);
    }
    const href = source.href;
    if (!href) {
      issues.push(`${index}: source destination missing`);
    } else {
      const expectedHref = href.startsWith('/zh-cn/')
        ? `/en/${href.slice('/zh-cn/'.length)}`
        : href;
      if (localized.href !== expectedHref) {
        issues.push(`${index}: destination mismatch`);
      }
    }
    if (!localized.visualOwner) {
      issues.push(`${index}: missing passive visual owner`);
    }
    if (!localized.hitIsAnchor) {
      issues.push(`${index}: native anchor must be exact hit target`);
    }
  }
  return issues;
}
