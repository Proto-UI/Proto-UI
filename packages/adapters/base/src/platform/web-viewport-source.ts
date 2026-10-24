/** One bounded layout-viewport fact, in CSS pixels (including any scrollbar). */
export function readWebViewportWidth(
  doc: Document | undefined,
  key: string
): number | 'unknown' | undefined {
  if (key !== 'viewport.width') return undefined;
  const width = doc?.defaultView?.innerWidth;
  return typeof width === 'number' && Number.isFinite(width) && width >= 0 ? width : 'unknown';
}
type WidthKey = 'viewport.width';
const sources = new WeakMap<Document, ReturnType<typeof createDocumentSource>>();
function createDocumentSource(doc: Document) {
  const view = doc.defaultView!;
  const listeners = new Set<() => void>();
  let generation = 0;
  let pending = false;
  let value = readWebViewportWidth(doc, 'viewport.width');
  let detach: (() => void) | undefined;
  function attach() {
    value = readWebViewportWidth(doc, 'viewport.width');
    const current = generation;
    const onResize = () => {
      if (current !== generation || pending || !listeners.size) return;
      pending = true;
      queueMicrotask(() => {
        if (current !== generation) return;
        pending = false;
        const next = readWebViewportWidth(doc, 'viewport.width');
        if (next === value) return;
        value = next;
        for (const notify of [...listeners]) {
          if (!listeners.has(notify)) continue;
          try {
            notify();
          } catch (error) {
            queueMicrotask(() => {
              throw error;
            });
          }
        }
      });
    };
    view.addEventListener('resize', onResize);
    detach = () => view.removeEventListener('resize', onResize);
  }
  return {
    subscribe(keys: readonly WidthKey[], invalidate: () => void) {
      if (!keys.includes('viewport.width')) return () => {};
      // Subscription identity is independent of callback identity.
      const notify = () => invalidate();
      listeners.add(notify);
      if (listeners.size === 1) attach();
      return () => {
        if (!listeners.delete(notify) || listeners.size) return;
        ++generation;
        pending = false;
        detach?.();
        detach = undefined;
      };
    },
  };
}
/** Pair only with the default reader for this Document; no listener until leased. */
export function createDefaultWebViewportSource(
  getter: (key: string) => unknown,
  doc = typeof document === 'undefined' ? undefined : document
) {
  const view = doc?.defaultView;
  if (
    !doc ||
    typeof view?.addEventListener !== 'function' ||
    typeof view?.removeEventListener !== 'function'
  )
    return undefined;
  let source = sources.get(doc);
  if (!source) {
    source = createDocumentSource(doc);
    sources.set(doc, source);
  }
  return { getter, subscribe: source.subscribe };
}
