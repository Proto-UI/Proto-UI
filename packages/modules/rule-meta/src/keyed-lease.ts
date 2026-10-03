import type { RuleMetaGetter } from './caps';

export type KeyedSource<Key extends string> = {
  readonly getter: RuleMetaGetter;
  subscribe(keys: readonly Key[], invalidate: () => void): () => void;
};

/** Private mechanics only: each bounded capability retains its own independent lease. */
export function createKeyedMetaLease<Key extends string>(
  canSubscribe: () => boolean,
  requestStyleReevaluation: () => void
) {
  let source: KeyedSource<Key> | null = null;
  let keys: readonly Key[] = [];
  let unsubscribe: (() => void) | null = null;
  let generation = 0;

  function release(): boolean {
    const changed = source !== null;
    ++generation;
    const dispose = unsubscribe;
    unsubscribe = null;
    source = null;
    keys = [];
    dispose?.();
    return changed;
  }

  return {
    reconcile(
      nextKeys: readonly Key[],
      getter: RuleMetaGetter | null,
      nextSource: KeyedSource<Key> | null
    ): void {
      if (!canSubscribe() || nextKeys.length === 0 || !nextSource || nextSource.getter !== getter) {
        const changed = release();
        if (changed && canSubscribe()) requestStyleReevaluation();
        return;
      }
      if (nextSource === source && unsubscribe && nextKeys.join() === keys.join()) return;
      release();
      source = nextSource;
      keys = nextKeys;
      const current = generation;
      const dispose = nextSource.subscribe(nextKeys, () => {
        if (current !== generation || !unsubscribe || !canSubscribe()) return;
        requestStyleReevaluation();
      });
      if (current !== generation || !canSubscribe()) {
        dispose();
        return;
      }
      unsubscribe = dispose;
      requestStyleReevaluation();
    },
    release,
    read(key: Key, getter: RuleMetaGetter | null): unknown {
      return canSubscribe() && unsubscribe && source?.getter === getter && keys.includes(key)
        ? getter?.(key)
        : 'unknown';
    },
  };
}
