/** Website shell navigation contract.
 *
 * The label and destination of a primary navigation entry are one authored
 * fact, not a per-locale copy: the documentation Header and the homepage shell
 * resolve the same rows for whichever locale the current route carries. Keeping
 * the locale tables here lets native-anchor evidence assert the rendered
 * accessible names against the definition that produced them instead of
 * re-translating them inside a test.
 */
export type SiteLocale = 'en' | 'zh-cn';

export const SITE_PRIMARY_NAVIGATION = [
  { path: '/start-here/what-you-saw/', label: { en: 'Docs', 'zh-cn': '文档' } },
  { path: '/ui-libraries/shadcn/button/', label: { en: 'Libraries', 'zh-cn': '组件库' } },
  { path: '/whitepaper/0-preface/', label: { en: 'Whitepaper', 'zh-cn': '白皮书' } },
] as const;

export const SITE_SHELL_LABELS = {
  en: { primaryNavigation: 'Primary navigation' },
  'zh-cn': { primaryNavigation: '主导航' },
} as const;

/** The site's root locale is `en`; `zh-cn` is the only other configured locale. */
export const siteLocale = (locale: string | undefined): SiteLocale =>
  locale === 'zh-cn' ? 'zh-cn' : 'en';

export const siteShellLabels = (locale: string | undefined) =>
  SITE_SHELL_LABELS[siteLocale(locale)];

export const sitePrimaryNavigation = (locale: string | undefined) => {
  const resolved = siteLocale(locale);
  return SITE_PRIMARY_NAVIGATION.map(({ path, label }) => ({ path, label: label[resolved] }));
};
