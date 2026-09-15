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
        lastValue = resolveWebColorScheme();
        onChange = () => {
          if (current !== generation || pending) return;
          pending = true;
          queueMicrotask(() => {
            if (current !== generation) return;
            pending = false;
            const nextValue = resolveWebColorScheme();
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
        observer = new MutationObserver(onChange);
        observer.observe(doc.documentElement, {
          attributes: true,
          attributeFilter: ['class', 'data-theme'],
        });
        if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
          media = window.matchMedia(DARK_MEDIA_QUERY);
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
export function createDefaultWebColorSchemeSource(getter: (key: string) => unknown) {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return undefined;

  let source = documentSources.get(document);
  if (!source) {
    source = createDocumentSource(document);
    documentSources.set(document, source);
  }
  return { getter, subscribe: source.subscribe };
}
