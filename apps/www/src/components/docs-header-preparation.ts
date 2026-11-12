const pendingPreparations = new WeakMap<Document, { waiters: Set<() => void>; release(): void }>();

export function hasPendingDocsHeaderPreparation(document: Document): boolean {
  return pendingPreparations.has(document);
}

export function reserveDocsHeaderPreparation(document: Document): () => void {
  const previous = pendingPreparations.get(document);
  const preparation = {
    waiters: new Set<() => void>(),
    release() {
      if (pendingPreparations.get(document) === preparation) pendingPreparations.delete(document);
      for (const resume of preparation.waiters) queueMicrotask(resume);
      preparation.waiters.clear();
    },
  };
  pendingPreparations.set(document, preparation);
  previous?.release();
  return preparation.release;
}

/** Coalesce only work waiting on Docs Header. Other projection starts retain
 * their original timing. Recheck the barrier after a superseding attempt. */
export function deferUntilDocsHeaderPrepared(
  root: HTMLElement,
  run: () => void | Promise<unknown>
) {
  const document = root.ownerDocument;
  let waiting:
    | {
        promise: Promise<unknown>;
        resolve(value?: unknown): void;
        reject(error: unknown): void;
      }
    | undefined;
  let unsubscribe: (() => void) | undefined;
  let cancelled = false;
  const resume = () => {
    const work = waiting;
    if (!work) return;
    const preparation = pendingPreparations.get(document);
    if (preparation) {
      preparation.waiters.add(resume);
      unsubscribe = () => preparation.waiters.delete(resume);
      return;
    }
    waiting = undefined;
    unsubscribe = undefined;
    try {
      work.resolve(root.isConnected && root.ownerDocument === document ? run() : undefined);
    } catch (error) {
      work.reject(error);
    }
  };
  return {
    prepare() {
      if (cancelled) return;
      if (waiting) return waiting.promise;
      if (!pendingPreparations.has(document)) return run();
      let resolve!: (value?: unknown) => void;
      let reject!: (error: unknown) => void;
      const promise = new Promise<unknown>((complete, fail) => {
        resolve = complete;
        reject = fail;
      });
      waiting = { promise, resolve, reject };
      resume();
      return promise;
    },
    cancel() {
      cancelled = true;
      unsubscribe?.();
      unsubscribe = undefined;
      waiting?.resolve();
      waiting = undefined;
    },
  };
}
