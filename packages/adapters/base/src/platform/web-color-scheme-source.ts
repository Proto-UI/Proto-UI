import { resolveWebColorScheme } from './web-preferences';

const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';
const documentSources = new WeakMap<Document, ReturnType<typeof createDocumentSource>>();

function createDocumentSource(doc: Document) {
  const listeners = new Set<{ invalidate: () => void }>();
  let observer: MutationObserver | undefined;
  let media: MediaQueryList | undefined;
  let onChange: (() => void) | undefined;
  let generation = 0;
  let pending = false;
  let lastValue: ReturnType<typeof resolveWebColorScheme>;

  return {
    subscribe(invalidate: () => void) {
      const listener = { invalidate };
      listeners.add(listener);

      if (listeners.size === 1) {
        const current = ++generation;
        lastValue = resolveWebColorScheme(doc);
        onChange = () => {
          if (current !== generation || pending) return;
          pending = true;
          queueMicrotask(() => {
            if (current !== generation) return;
            pending = false;
            const nextValue = resolveWebColorScheme(doc);
            if (nextValue === lastValue) return;
            lastValue = nextValue;
            for (const entry of [...listeners]) {
              if (!listeners.has(entry)) continue;
              try {
                entry.invalidate();
              } catch (error) {
                queueMicrotask(() => {
                  throw error;
                });
              }
            }
          });
        };
        const Observer = doc.defaultView?.MutationObserver ?? MutationObserver;
        observer = new Observer(onChange);
        observer.observe(doc.documentElement, {
          attributes: true,
          attributeFilter: ['class', 'data-theme'],
        });
        const view = doc.defaultView;
        if (typeof view?.matchMedia === 'function') {
          media = view.matchMedia(DARK_MEDIA_QUERY);
          media.addEventListener('change', onChange);
        }
      }

      return () => {
        if (!listeners.delete(listener) || listeners.size > 0) return;
        ++generation;
        pending = false;
        observer?.disconnect();
        if (onChange) media?.removeEventListener('change', onChange);
        observer = undefined;
        media = undefined;
        onChange = undefined;
      };
    },
  };
}

/** Pairs the default reader with a lazy, shared document-theme notification source. */
export function createDefaultWebColorSchemeSource(
  getter: (key: string) => unknown,
  doc: Document | undefined = typeof document === 'undefined' ? undefined : document
) {
  if (!doc || (!doc.defaultView?.MutationObserver && typeof MutationObserver === 'undefined'))
    return undefined;

  let source = documentSources.get(doc);
  if (!source) {
    source = createDocumentSource(doc);
    documentSources.set(doc, source);
  }
  return { getter, subscribe: source.subscribe };
}
