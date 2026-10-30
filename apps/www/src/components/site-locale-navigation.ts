/** Locale routing is application policy, not Select behavior. Both the native
 * recovery control and every Proto projection use this one validated path. */
export function navigateSiteLocale(
  window: Window,
  currentLocale: string,
  paths: Readonly<Record<string, string>>,
  locale: unknown
): boolean {
  if (typeof locale !== 'string' || locale === currentLocale) return false;
  if (!Object.prototype.hasOwnProperty.call(paths, locale)) return false;
  const path = paths[locale];
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) return false;
  const next = new URL(window.location.href);
  // Route maps contain pathnames only; retain the actual current query/hash.
  next.pathname = path;
  try {
    window.localStorage.setItem('preferred-locale', locale);
  } catch {
    // Preference persistence is optional; navigation is not.
  }
  window.document.cookie = `preferred-locale=${encodeURIComponent(locale)}; path=/; max-age=31536000; SameSite=Lax`;
  window.location.href = next.href;
  return true;
}
