import {
  createDefaultWebColorSchemeSource,
  notifyColorSchemeListeners,
} from '@proto.ui/adapter-base';

export function createRebindableColorSchemeSource(getter: (key: string) => unknown, doc: Document) {
  let source = createDefaultWebColorSchemeSource(getter, doc);
  let unsubscribe: (() => void) | undefined;
  const listeners = new Set<() => void>();
  const notify = () => notifyColorSchemeListeners(listeners);
  return {
    getter,
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (listeners.size === 1) unsubscribe = source?.subscribe(notify);
      return () => {
        listeners.delete(listener);
        if (!listeners.size) unsubscribe?.();
      };
    },
    adoptDocument(next: Document) {
      if (doc === next) return;
      doc = next;
      unsubscribe?.();
      source = createDefaultWebColorSchemeSource(getter, next);
      unsubscribe = listeners.size ? source?.subscribe(notify) : undefined;
      notify();
    },
  };
}
