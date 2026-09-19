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
  subscribe(listener: () => void): () => void;
  adoptDocument(doc: Document): void;
  dispose(): void;
};

const environmentOwners = new WeakMap<HTMLElement, ShadowColorSchemeEnvironmentOwner>();

/**
 * Creates the default dynamic source on the shared per-document observation
 * from the base Adapter profile (one MutationObserver and one media query per
 * document), without changing the pull-only Web meta getter used by existing
 * Adapter profiles.
 */
export function createDefaultShadowColorSchemeSource(doc?: Document): ShadowColorSchemeSource {
  const owningDocument = doc ?? (typeof document === 'undefined' ? undefined : document);
  const resolve = () => resolveWebColorScheme(owningDocument ?? null);
  const shared = owningDocument
    ? createDefaultWebColorSchemeSource(() => resolve(), owningDocument)
    : undefined;
  return Object.freeze({
    get: resolve,
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

  const explicitSource = source !== undefined;
  let resolvedSource = source ?? createDefaultShadowColorSchemeSource(host.ownerDocument);
  let sourceDocument = explicitSource ? null : host.ownerDocument;
  const previousMarker = host.getAttribute(SHADOW_COLOR_SCHEME_ATTRIBUTE);
  let colorScheme = readColorScheme(() => resolvedSource.get());
  let disposed = false;
  let sourceGeneration = 0;
  const listeners = new Set<() => void>();
  host.setAttribute(SHADOW_COLOR_SCHEME_ATTRIBUTE, colorScheme);

  const notifyListeners = () => {
    for (const listener of [...listeners]) {
      if (!listeners.has(listener)) continue;
      try {
        listener();
      } catch (error) {
        queueMicrotask(() => {
          throw error;
        });
      }
    }
  };

  const syncFromSource = (activeSource: ShadowColorSchemeSource) => {
    const next = readColorScheme(() => activeSource.get());
    if (next === colorScheme && host.getAttribute(SHADOW_COLOR_SCHEME_ATTRIBUTE) === colorScheme) {
      return;
    }
    colorScheme = next;
    host.setAttribute(SHADOW_COLOR_SCHEME_ATTRIBUTE, colorScheme);
    notifyListeners();
  };
  const subscribeSource = (nextSource: ShadowColorSchemeSource, generation: number) => {
    const subscription = nextSource.subscribe(() => {
      if (disposed || sourceGeneration !== generation || resolvedSource !== nextSource) return;
      syncFromSource(nextSource);
    });
    if (typeof subscription !== 'function') {
      throw new Error('[WC Adapter] invalid Shadow color-scheme source subscription.');
    }
    return subscription;
  };

  let unsubscribe: () => void;
  try {
    unsubscribe = subscribeSource(resolvedSource, 1);
    sourceGeneration = 1;
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
    get source() {
      return resolvedSource;
    },
    subscribe(listener) {
      if (disposed) return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    adoptDocument(doc) {
      if (disposed || explicitSource || sourceDocument === doc) return;
      const nextSource = createDefaultShadowColorSchemeSource(doc);
      const nextColorScheme = readColorScheme(() => nextSource.get());
      const nextGeneration = sourceGeneration + 1;
      const nextUnsubscribe = subscribeSource(nextSource, nextGeneration);
      const previousUnsubscribe = unsubscribe;
      resolvedSource = nextSource;
      sourceDocument = doc;
      sourceGeneration = nextGeneration;
      unsubscribe = nextUnsubscribe;
      if (
        nextColorScheme !== colorScheme ||
        host.getAttribute(SHADOW_COLOR_SCHEME_ATTRIBUTE) !== nextColorScheme
      ) {
        colorScheme = nextColorScheme;
        host.setAttribute(SHADOW_COLOR_SCHEME_ATTRIBUTE, colorScheme);
        notifyListeners();
      }
      previousUnsubscribe();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      sourceGeneration += 1;
      listeners.clear();
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
