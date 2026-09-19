export type WebColorScheme = 'light' | 'dark';

const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';
const REDUCED_MOTION_MEDIA_QUERY = '(prefers-reduced-motion: reduce)';

function getDocument(): Document | null {
  return typeof document !== 'undefined' ? document : null;
}

function getWindow(): Window | null {
  return typeof window !== 'undefined' ? window : null;
}

/**
 * Resolves the effective Web color scheme used by Proto UI adapters.
 * Explicit host theme markers win; the system preference is only a fallback.
 */
export function resolveWebColorScheme(
  doc: Document | null = getDocument(),
  view: Window | null = doc ? doc.defaultView : getWindow()
): WebColorScheme {
  const root = doc?.documentElement ?? null;
  const theme = root?.dataset.theme;

  if (theme === 'dark' || root?.classList.contains('dark')) return 'dark';
  if (theme === 'light' || root?.classList.contains('light')) return 'light';

  if (typeof view?.matchMedia === 'function') {
    return view.matchMedia(DARK_MEDIA_QUERY).matches ? 'dark' : 'light';
  }

  return 'light';
}

export function createDefaultWebMetaGetter(): (key: string) => unknown {
  return (key: string) => {
    if (key === 'colorScheme') return resolveWebColorScheme();

    if (key === 'reducedMotion') {
      const view = getWindow();
      if (typeof view?.matchMedia === 'function') {
        return view.matchMedia(REDUCED_MOTION_MEDIA_QUERY).matches ? 'reduce' : 'no-preference';
      }
      return 'no-preference';
    }

    return undefined;
  };
}
