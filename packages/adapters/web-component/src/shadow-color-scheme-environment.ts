import {
  createDefaultWebColorSchemeSource,
  resolveWebColorScheme,
  type WebColorScheme,
} from '@proto.ui/adapter-base';

export const SHADOW_COLOR_SCHEME_ATTRIBUTE = 'data-pui-color-scheme';

export type ShadowColorSchemeSource = Readonly<{
  get(): WebColorScheme;
  subscribe(listener: () => void): () => void;
}>;

export type ShadowColorSchemeEnvironmentOwner = {
  readonly colorScheme: WebColorScheme;
  readonly source: ShadowColorSchemeSource;
  dispose(): void;
};

const environmentOwners = new WeakMap<HTMLElement, ShadowColorSchemeEnvironmentOwner>();

/**
 * Creates the default dynamic source on the shared per-document observation
 * from the base Adapter profile (one MutationObserver and one media query per
 * document), without changing the pull-only Web meta getter used by existing
 * Adapter profiles.
 */
export function createDefaultShadowColorSchemeSource(): ShadowColorSchemeSource {
  const shared =
    typeof document === 'undefined'
      ? undefined
      : createDefaultWebColorSchemeSource(() => resolveWebColorScheme());
  return Object.freeze({
    get: resolveWebColorScheme,
    subscribe(listener) {
      return shared?.subscribe(listener) ?? (() => {});
    },
  });
}

/**
 * Owns the host-local selector environment for one future split Shadow owner.
 *
 * The helper remains private to the package and is not wired into either
 * existing boolean profile. Its source is retained so a future split profile
 * can use the same truth for runtime color-scheme metadata.
 */
export function createShadowColorSchemeEnvironmentOwner(
  host: HTMLElement,
  source?: ShadowColorSchemeSource
): ShadowColorSchemeEnvironmentOwner {
  const existing = environmentOwners.get(host);
  if (existing) return existing;

  const resolvedSource = source ?? createDefaultShadowColorSchemeSource();
  const previousMarker = host.getAttribute(SHADOW_COLOR_SCHEME_ATTRIBUTE);
  let colorScheme = readColorScheme(() => resolvedSource.get());
  let disposed = false;
  host.setAttribute(SHADOW_COLOR_SCHEME_ATTRIBUTE, colorScheme);

  let unsubscribe: () => void;
  try {
    const subscription = resolvedSource.subscribe(() => {
      if (disposed) return;
      const next = readColorScheme(() => resolvedSource.get());
      if (
        next === colorScheme &&
        host.getAttribute(SHADOW_COLOR_SCHEME_ATTRIBUTE) === colorScheme
      ) {
        return;
      }
      colorScheme = next;
      host.setAttribute(SHADOW_COLOR_SCHEME_ATTRIBUTE, colorScheme);
    });
    if (typeof subscription !== 'function') {
      throw new Error('[WC Adapter] invalid Shadow color-scheme source subscription.');
    }
    unsubscribe = subscription;
  } catch (error) {
    // A source may retain its callback before throwing; revoke its write authority too.
    disposed = true;
    restoreMarker(host, previousMarker);
    throw error;
  }

  const owner: ShadowColorSchemeEnvironmentOwner = {
    get colorScheme() {
      return colorScheme;
    },
    source: resolvedSource,
    dispose() {
      if (disposed) return;
      disposed = true;
      try {
        unsubscribe();
      } finally {
        if (environmentOwners.get(host) === owner) environmentOwners.delete(host);
        if (host.getAttribute(SHADOW_COLOR_SCHEME_ATTRIBUTE) === colorScheme) {
          restoreMarker(host, previousMarker);
        }
      }
    },
  };

  environmentOwners.set(host, owner);
  return owner;
}

function readColorScheme(get: () => WebColorScheme): WebColorScheme {
  const value = get();
  if (value === 'light' || value === 'dark') return value;
  throw new Error(`[WC Adapter] invalid Shadow color-scheme source value: ${String(value)}.`);
}

function restoreMarker(host: HTMLElement, value: string | null): void {
  if (value === null) host.removeAttribute(SHADOW_COLOR_SCHEME_ATTRIBUTE);
  else host.setAttribute(SHADOW_COLOR_SCHEME_ATTRIBUTE, value);
}
