import type { GeneratedModule, PrototypeIR } from './ir';
import { nativeMetaArtifact } from './native-async';

/** Exact default-web inputs with mounted sources or existing sampled semantics.
 * Other keys require a target provider before native lowering.
 */
export const nativeRuleMetaKeys = new Set([
  'colorScheme',
  'viewport.width',
  'preference.reducedMotion',
  'preference.reducedTransparency',
  'preference.contrast',
  'preference.forcedColors',
  // Existing sampled facts do not acquire an invalidation source.
  'reducedMotion',
  'styleSupport.alphaFill',
  'styleSupport.backdropBlur4px',
]);

export function collectNativeRuleMeta(ir: PrototypeIR): string[] {
  const keys = new Set<string>();
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== 'object') return;
    const node = value as Record<string, unknown>;
    if (node.kind === 'rule') {
      const declaration = node.declaration as { deps: { kind: string; key?: string }[] };
      for (const dependency of declaration.deps)
        if (dependency.kind === 'meta') keys.add(dependency.key!);
    }
    for (const child of Object.values(node)) visit(child);
  };
  visit(ir);
  return [...keys].sort();
}

export const nativeRuleMetaArtifact: NonNullable<GeneratedModule['supportingFiles']>[number] = {
  path: '.proto-ui/meta/web-rule-source-v1.ts',
  kind: 'source',
  contents: `// Default-web Rule inputs only. No Rule interpreter, authored state or structural update.
import { readNativeWebMeta } from './web-snapshot-v1';

type Source = { subscribe(notify: () => void): (() => void) | undefined };
const documents = new WeakMap<Document, Map<string, Source>>();
const preferences: Record<string, readonly [string, readonly string[]]> = {
  'preference.reducedMotion': ['prefers-reduced-motion', ['no-preference', 'reduce']],
  'preference.reducedTransparency': ['prefers-reduced-transparency', ['no-preference', 'reduce']],
  'preference.contrast': ['prefers-contrast', ['no-preference', 'less', 'more', 'custom']],
  'preference.forcedColors': ['forced-colors', ['none', 'active']],
};
function sourceFor(doc: Document, key: string): Source | undefined {
  const view = doc.defaultView;
  if (!view) return undefined;
  if (key !== 'colorScheme' && key !== 'viewport.width' && !Object.hasOwn(preferences, key)) return undefined;
  if (key === 'colorScheme' && typeof view.MutationObserver !== 'function') return undefined;
  if (Object.hasOwn(preferences, key) && typeof view.matchMedia !== 'function') return undefined;
  let sources = documents.get(doc);
  if (!sources) { sources = new Map(); documents.set(doc, sources); }
  const existing = sources.get(key);
  if (existing) return existing;
  const listeners = new Set<() => void>();
  let generation = 0, queued = false, last: unknown;
  let cleanups: (() => void)[] = [];
  const source: Source = {
    subscribe(notify) {
      // Distinct leases even if the same callback is reused by separate owners.
      const listener = () => notify();
      listeners.add(listener);
      if (listeners.size === 1) {
        const current = ++generation;
        const change = () => {
          if (current !== generation || queued) return;
          queued = true;
          queueMicrotask(() => {
            if (current !== generation) return;
            queued = false;
            const next = readNativeWebMeta(doc, key);
            if (Object.is(next, last)) return;
            last = next;
            for (const callback of [...listeners]) if (listeners.has(callback)) {
              try { callback(); } catch (error) { queueMicrotask(() => { throw error; }); }
            }
          });
        };
        const media = (query: string) => {
          const value = view.matchMedia(query);
          if (typeof value.addEventListener === 'function') {
            value.addEventListener('change', change);
            cleanups.push(() => value.removeEventListener('change', change));
          } else if (typeof value.addListener === 'function') {
            value.addListener(change);
            cleanups.push(() => value.removeListener(change));
          }
        };
        try {
          if (key === 'colorScheme') {
            const observer = new view.MutationObserver(change);
            observer.observe(doc.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
            cleanups.push(() => observer.disconnect());
            if (typeof view.matchMedia === 'function') media('(prefers-color-scheme: dark)');
          } else if (key === 'viewport.width') {
            view.addEventListener('resize', change);
            cleanups.push(() => view.removeEventListener('resize', change));
          } else if (Object.hasOwn(preferences, key)) {
            const [feature, values] = preferences[key];
            for (const value of values) media('(' + feature + ': ' + value + ')');
          }
          // Subscribe first, then reconcile the same getter paired with this source.
          last = readNativeWebMeta(doc, key);
        } catch {
          listeners.delete(listener); ++generation; queued = false;
          for (const cleanup of cleanups.splice(0)) cleanup();
          return undefined;
        }
      }
      return () => {
        if (!listeners.delete(listener) || listeners.size) return;
        ++generation; queued = false;
        for (const cleanup of cleanups.splice(0)) cleanup();
      };
    },
  };
  sources.set(key, source);
  return source;
}

export function createNativeRuleMeta(getDocument: () => Document | undefined, keys: readonly string[]) {
  let active = false, document: Document | undefined, generation = 0;
  let invalidate: (() => void) | undefined;
  let cleanups: (() => void)[] = [];
  let requestedKeys: readonly string[] = [];
  const leased = new Set<string>();
  function release(): void {
    ++generation;
    for (const cleanup of cleanups.splice(0)) cleanup();
    leased.clear();
  }
  function reconcile(): void {
    const next = active ? getDocument() : undefined;
    if (next === document) return;
    release(); document = next;
    if (!next) return;
    const current = generation;
    try {
      for (const key of requestedKeys) {
        const source = sourceFor(next, key);
        if (!source) continue;
        const release = source.subscribe(() => {
          if (!active || current !== generation) return;
          // Adoption is reconciled before reading; an old document cannot project facts.
          if (getDocument() !== document) reconcile();
          invalidate?.();
        });
        if (!release) continue;
        cleanups.push(release);
        leased.add(key);
      }
    } catch (error) { release(); document = undefined; throw error; }
  }
  return {
    read(key: string): unknown {
      if (!active) return 'unknown';
      reconcile();
      if (key === 'colorScheme' || key === 'reducedMotion' || key === 'styleSupport.alphaFill' || key === 'styleSupport.backdropBlur4px')
        return readNativeWebMeta(document, key);
      return document && leased.has(key) ? readNativeWebMeta(document, key) : 'unknown';
    },
    subscribe(notify: () => void, requested: readonly string[]): () => void {
      if (active) throw new Error('[Rule meta] one mounted lease per logical owner');
      requestedKeys = requested.filter(key => keys.includes(key));
      active = true; invalidate = notify; reconcile();
      return () => { active = false; invalidate = undefined; release(); document = undefined; requestedKeys = []; };
    },
  };
}
`,
};

export const nativeRuleMetaArtifacts = [nativeMetaArtifact, nativeRuleMetaArtifact];
