/** Bounded draft preference inputs. This does not describe material rendering support. */
export const WEB_PREFERENCE_QUERIES = {
  'preference.reducedMotion': ['prefers-reduced-motion', ['no-preference', 'reduce']],
  'preference.reducedTransparency': ['prefers-reduced-transparency', ['no-preference', 'reduce']],
  'preference.contrast': ['prefers-contrast', ['no-preference', 'less', 'more', 'custom']],
  'preference.forcedColors': ['forced-colors', ['none', 'active']],
} as const;
type WebPreferenceKey = keyof typeof WEB_PREFERENCE_QUERIES;
type Query = { value: string; media: MediaQueryList };
const sources = new WeakMap<Document, ReturnType<typeof createDocumentSource>>();

function queries(doc: Document, key: WebPreferenceKey): Query[] {
  const view = doc.defaultView;
  if (typeof view?.matchMedia !== 'function') return [];
  const [feature, values] = WEB_PREFERENCE_QUERIES[key];
  try {
    return values.map((value) => ({ value, media: view.matchMedia(`(${feature}: ${value})`) }));
  } catch {
    return [];
  }
}
function sample(entries: readonly Query[]): string {
  const matches = entries.filter((entry) => entry.media.matches);
  // No match is unsupported/unknown. Conflicting matches are not affirmative evidence either.
  return matches.length === 1 ? matches[0].value : 'unknown';
}
export function readWebPreference(doc: Document | undefined, key: string): string | undefined {
  if (!Object.prototype.hasOwnProperty.call(WEB_PREFERENCE_QUERIES, key)) return undefined;
  if (!doc) return 'unknown';
  const typedKey = key as WebPreferenceKey;
  return sources.get(doc)?.read(typedKey) ?? sample(queries(doc, typedKey));
}
function createDocumentSource(doc: Document) {
  type Listener = { keys: readonly WebPreferenceKey[]; invalidate: () => void };
  type Observed = { entries: Query[]; value: string; onChange: () => void };
  const listeners = new Set<Listener>();
  const observed = new Map<WebPreferenceKey, Observed>();
  let generation = 0;
  let pending = false;
  function reconcileQueries() {
    const needed = new Set([...listeners].flatMap((listener) => [...listener.keys]));
    for (const [key, state] of observed) {
      if (needed.has(key)) continue;
      observed.delete(key);
      for (const { media } of state.entries) media.removeEventListener('change', state.onChange);
    }
    for (const key of needed) {
      if (observed.has(key)) continue;
      const entries = queries(doc, key);
      // A readable but unobservable query cannot supply a current preference lease.
      const observable =
        entries.length > 0 &&
        entries.every(
          ({ media }) =>
            typeof media.addEventListener === 'function' &&
            typeof media.removeEventListener === 'function'
        );
      const state: Observed = {
        entries: observable ? entries : [],
        value: 'unknown',
        onChange: () => {},
      };
      state.value = sample(state.entries);
      const current = generation;
      state.onChange = () => {
        if (current !== generation || observed.get(key) !== state || pending) return;
        pending = true;
        queueMicrotask(() => {
          if (current !== generation) return;
          pending = false;
          const changed = new Set<WebPreferenceKey>();
          for (const [activeKey, active] of observed) {
            const next = sample(active.entries);
            if (next !== active.value) {
              active.value = next;
              changed.add(activeKey);
            }
          }
          for (const listener of [...listeners]) {
            if (!listeners.has(listener) || !listener.keys.some((k) => changed.has(k))) continue;
            try {
              listener.invalidate();
            } catch (error) {
              // One consumer cannot starve another; preserve ordinary asynchronous error reporting.
              queueMicrotask(() => {
                throw error;
              });
            }
          }
        });
      };
      observed.set(key, state);
      for (const { media } of state.entries) media.addEventListener('change', state.onChange);
    }
  }
  return {
    read(key: WebPreferenceKey) {
      const state = observed.get(key);
      return state ? sample(state.entries) : sample(queries(doc, key));
    },
    subscribe(keys: readonly WebPreferenceKey[], invalidate: () => void) {
      const listener = {
        keys: [...new Set(keys)].filter((key) =>
          Object.prototype.hasOwnProperty.call(WEB_PREFERENCE_QUERIES, key)
        ),
        invalidate,
      };
      listeners.add(listener);
      reconcileQueries();
      return () => {
        if (!listeners.delete(listener)) return;
        if (listeners.size === 0) {
          ++generation;
          pending = false;
        }
        reconcileQueries();
      };
    },
  };
}
/** The supplied reader must be the default reader for the same Document realm. */
export function createDefaultWebPreferenceSource(
  getter: (key: string) => unknown,
  doc = typeof document === 'undefined' ? undefined : document
) {
  if (!doc) return undefined;
  let source = sources.get(doc);
  if (!source) {
    source = createDocumentSource(doc);
    sources.set(doc, source);
  }
  return { getter, subscribe: source.subscribe };
}
