import {
  createDefaultWebPreferenceSource,
  createDefaultWebStyleSupportSource,
} from '@proto.ui/adapter-base';

type KeyedSource<Key extends string> = {
  readonly getter: (key: string) => unknown;
  subscribe(keys: readonly Key[], invalidate: () => void): () => void;
};

/** Private lifetime bridge for the two fixed Web namespaces, not a public Meta bus. */
function createRebindableSource<Key extends string>(
  getter: (key: string) => unknown,
  doc: Document,
  createSource: (getter: (key: string) => unknown, doc: Document) => KeyedSource<Key> | undefined
) {
  type Subscription = {
    keys: readonly Key[];
    invalidate: () => void;
    release?: () => void;
  };
  const subscriptions = new Set<Subscription>();
  let source = createSource(getter, doc);
  let generation = 0;
  let disposed = false;
  const attach = (subscription: Subscription) => {
    const current = generation;
    subscription.release = source?.subscribe(subscription.keys, () => {
      if (current === generation && subscriptions.has(subscription)) subscription.invalidate();
    });
  };
  return {
    getter,
    subscribe(keys: readonly Key[], invalidate: () => void) {
      if (disposed) throw new Error('WC:keyed-meta-source-disposed');
      const subscription: Subscription = { keys, invalidate };
      subscriptions.add(subscription);
      attach(subscription);
      return () => {
        if (!subscriptions.delete(subscription)) return;
        subscription.release?.();
      };
    },
    adoptDocument(next: Document) {
      if (disposed || next === doc) return;
      doc = next;
      const current = ++generation;
      for (const subscription of subscriptions) subscription.release?.();
      source = createSource(getter, next);
      // Absent browser APIs remain unknown through the default Document reader.
      // Keep the Adapter bridge so a later document can supply those facts.
      for (const subscription of subscriptions) attach(subscription);
      queueMicrotask(() => {
        if (current !== generation || disposed) return;
        for (const subscription of subscriptions) subscription.invalidate();
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      ++generation;
      const previous = [...subscriptions];
      subscriptions.clear();
      for (const subscription of previous) subscription.release?.();
    },
  };
}

export function createRebindableWebKeyedMetaSources(
  getter: (key: string) => unknown,
  doc: Document
) {
  const preferenceSource = createRebindableSource(getter, doc, createDefaultWebPreferenceSource);
  const styleSupportSource = createRebindableSource(
    getter,
    doc,
    createDefaultWebStyleSupportSource
  );
  return {
    preferenceSource,
    styleSupportSource,
    adoptDocument(next: Document) {
      preferenceSource.adoptDocument(next);
      styleSupportSource.adoptDocument(next);
    },
    dispose() {
      preferenceSource.dispose();
      styleSupportSource.dispose();
    },
  };
}
