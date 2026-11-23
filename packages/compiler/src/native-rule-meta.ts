import type { GeneratedModule, PrototypeIR } from './ir';
import { nativeMetaArtifact, nativeMetaSubscriptionArtifact } from './native-async';

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
import { nativeMediaBinding, releaseNativeMeta } from './subscription-v1';

type Source = { read(): unknown; subscribe(notify: () => void): (() => void) | undefined };
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
  const addResize = key === 'viewport.width' ? view.addEventListener : undefined;
  const removeResize = key === 'viewport.width' ? view.removeEventListener : undefined;
  if (key === 'viewport.width' && (typeof addResize !== 'function' || typeof removeResize !== 'function')) return undefined;
  let sources = documents.get(doc);
  if (!sources) { sources = new Map(); documents.set(doc, sources); }
  const existing = sources.get(key);
  if (existing) return existing;
  const listeners = new Set<() => void>();
  let generation = 0, queued = false, live = true, ready = false, last: unknown;
  let cleanups: (() => void)[] = [];
  function stop() {
    if (!live) return;
    live = false; ready = false; ++generation; queued = false;
    const releases = cleanups; cleanups = []; listeners.clear();
    if (sources!.get(key) === source) sources!.delete(key);
    if (!sources!.size && documents.get(doc) === sources) documents.delete(doc);
    releaseNativeMeta(releases);
  }
  const source: Source = {
    read() {
      if (!live || !ready || doc.defaultView !== view) return 'unknown';
      const value = readNativeWebMeta(doc, key);
      return live && ready && doc.defaultView === view ? value : 'unknown';
    },
    subscribe(notify) {
      if (!live) return undefined;
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
            const next = source.read();
            if (Object.is(next, last)) return;
            last = next;
            for (const callback of [...listeners]) if (listeners.has(callback)) {
              try { callback(); } catch (error) { queueMicrotask(() => { throw error; }); }
            }
          });
        };
        const media = (query: string) => {
          const value = view.matchMedia(query);
          const binding = nativeMediaBinding(value, change);
          if (!binding) throw new Error('[Rule meta] missing paired media source');
          cleanups.push(binding.release);
          binding.attach();
        };
        try {
          if (key === 'colorScheme') {
            const observer = new view.MutationObserver(change);
            const observe = observer.observe, disconnect = observer.disconnect;
            cleanups.push(() => disconnect.call(observer));
            observe.call(observer, doc.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
            if (typeof view.matchMedia === 'function') media('(prefers-color-scheme: dark)');
          } else if (key === 'viewport.width') {
            cleanups.push(() => removeResize!.call(view, 'resize', change));
            addResize!.call(view, 'resize', change);
          } else if (Object.hasOwn(preferences, key)) {
            const [feature, values] = preferences[key];
            for (const value of values) media('(' + feature + ': ' + value + ')');
          }
          // Subscribe first, then reconcile the same getter paired with this source.
          ready = true; last = source.read();
        } catch (error) {
          // Preserve the existing unavailable-source fallback when rollback
          // succeeds. A secondary release failure cannot replace the initiating
          // registration failure when the failed boundary must be reported.
          try { stop(); } catch { throw error; }
          return undefined;
        }
      }
      return () => {
        if (!listeners.delete(listener) || listeners.size) return;
        stop();
      };
    },
  };
  sources.set(key, source);
  return source;
}

export function createNativeRuleMeta(getDocument: () => Document | undefined, keys: readonly string[]) {
  type Mount = { active: boolean; document: Document | undefined; generation: number;
    invalidate(): void; requested: readonly string[]; cleanups: (() => void)[]; leased: Map<string, Source> };
  let mounted: Mount | undefined;
  const currentMount = (mount: Mount, generation: number) =>
    mount.active && mounted === mount && mount.generation === generation;
  function release(mount: Mount): void {
    ++mount.generation;
    const cleanups = mount.cleanups; mount.cleanups = [];
    mount.leased.clear(); mount.document = undefined;
    releaseNativeMeta(cleanups);
  }
  function reconcile(mount: Mount): void {
    if (!mount.active || mounted !== mount) return;
    const observed = mount.generation;
    const next = getDocument();
    if (!currentMount(mount, observed)) return;
    if (next === mount.document) return;
    const current = observed + 1;
    release(mount);
    // A host release may already reconcile this same mount to a newer Document.
    // The outer operation cannot publish its captured destination or release the
    // nested operation's leases, even if its own registration later fails.
    if (!currentMount(mount, current)) return;
    mount.document = next;
    if (!next) return;
    try {
      for (const key of mount.requested) {
        const source = sourceFor(next, key);
        if (!currentMount(mount, current)) return;
        if (!source) continue;
        const off = source.subscribe(() => {
          if (!mount.active || mounted !== mount || current !== mount.generation) return;
          // Adoption is reconciled before reading; an old document cannot project facts.
          if (getDocument() !== mount.document) reconcile(mount);
          if (mount.active && mounted === mount) mount.invalidate();
        });
        if (!off) continue;
        if (!mount.active || mounted !== mount || current !== mount.generation) { off(); return; }
        mount.cleanups.push(off);
        mount.leased.set(key, source);
      }
    } catch (error) {
      if (currentMount(mount, current)) { try { release(mount); } catch {} }
      throw error;
    }
  }
  return {
    read(key: string): unknown {
      const mount = mounted;
      if (!mount?.active) return 'unknown';
      reconcile(mount);
      const generation = mount.generation;
      if (!currentMount(mount, generation)) return 'unknown';
      const value = key === 'colorScheme' || key === 'reducedMotion' || key === 'styleSupport.alphaFill' || key === 'styleSupport.backdropBlur4px'
        ? readNativeWebMeta(mount.document, key)
        : mount.leased.get(key)?.read() ?? 'unknown';
      if (!currentMount(mount, generation)) return 'unknown';
      const document = getDocument();
      if (!currentMount(mount, generation)) return 'unknown';
      if (document !== mount.document) { reconcile(mount); return 'unknown'; }
      return value;
    },
    subscribe(notify: () => void, requested: readonly string[]): () => void {
      if (mounted) throw new Error('[Rule meta] one mounted lease per logical owner');
      const mount: Mount = { active: true, document: undefined, generation: 0,
        invalidate: notify, requested: [...new Set(requested.filter(key => keys.includes(key)))], cleanups: [], leased: new Map() };
      mounted = mount;
      try { reconcile(mount); }
      catch (error) { mount.active = false; if (mounted === mount) mounted = undefined; try { release(mount); } catch {} throw error; }
      return () => {
        if (!mount.active) return;
        mount.active = false; if (mounted === mount) mounted = undefined;
        release(mount);
      };
    },
  };
}
`,
};

export const nativeRuleMetaArtifacts = [
  nativeMetaArtifact,
  nativeMetaSubscriptionArtifact,
  nativeRuleMetaArtifact,
];
