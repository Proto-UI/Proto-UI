import type { MaterialPolicyInput } from '@proto.ui/module-feedback/internal/shared-policy';
export type WebMaterialPreferences = {
  current(): MaterialPolicyInput['preferences'];
  subscribe(invalidate: () => void): () => void;
};
const windows = new WeakMap<WebMaterialPreferences, Window>();

/** Rebind only our known window-backed source. An arbitrary custom provider
 * retains its own policy and subscription contract across host adoption. */
export function resolveWebMaterialPreferences(
  preferences: WebMaterialPreferences | undefined,
  window: Window
): WebMaterialPreferences {
  const owner = preferences && windows.get(preferences);
  return !preferences || (owner && owner !== window)
    ? createWebMaterialPreferences(window)
    : preferences;
}

/** Unsupported preference queries remain unknown, independently of motion. */
export function createWebMaterialPreferences(window: Window): WebMaterialPreferences {
  const query = (text: string) => {
    try {
      return window.matchMedia?.(text) ?? null;
    } catch {
      return null;
    }
  };
  const motion = [
    query('(prefers-reduced-motion: no-preference)'),
    query('(prefers-reduced-motion: reduce)'),
  ];
  const transparency = [
    query('(prefers-reduced-transparency: no-preference)'),
    query('(prefers-reduced-transparency: reduce)'),
  ];
  const contrast = [
    query('(prefers-contrast: no-preference)'),
    query('(prefers-contrast: more)'),
    query('(prefers-contrast: less)'),
    query('(prefers-contrast: custom)'),
  ];
  const forced = [query('(forced-colors: none)'), query('(forced-colors: active)')];
  const select = <T extends string>(
    queries: (MediaQueryList | null)[],
    values: T[]
  ): T | 'unknown' => {
    const matches = queries.flatMap((q, i) => (q?.matches ? [values[i]] : []));
    return matches.length === 1 ? matches[0] : 'unknown';
  };
  const preferences: WebMaterialPreferences = {
    current: () => ({
      reducedMotion: select(motion, ['no-preference', 'reduce']),
      reducedTransparency: select(transparency, ['no-preference', 'reduce']),
      contrast: select(contrast, ['no-preference', 'more', 'less', 'custom']),
      forcedColors: select(forced, ['none', 'active']),
    }),
    subscribe(fn) {
      const all = [...motion, ...transparency, ...contrast, ...forced].filter((q) => q !== null);
      for (const q of all) q.addEventListener('change', fn);
      return () => {
        for (const q of all) q.removeEventListener('change', fn);
      };
    },
  };
  windows.set(preferences, window);
  return preferences;
}
