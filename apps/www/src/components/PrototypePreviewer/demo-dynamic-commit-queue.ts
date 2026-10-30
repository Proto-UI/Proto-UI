import type { DemoKeyedChild, DemoChildrenCommit } from './demo-types';
import type {
  createDynamicChildrenModel,
  DynamicChildrenTransaction,
} from './demo-dynamic-children';

type Model = ReturnType<typeof createDynamicChildrenModel>;
type Request = {
  slot: string;
  children: readonly DemoKeyedChild[];
  resolve(value: DemoChildrenCommit): void;
  reject(error: unknown): void;
};

/**
 * One serial host-commit lane per render, shared by all slots. Only queued work
 * is superseded. Once host commit starts it may finish before a newer request.
 * The host callback must check current() around its commit and ref publication.
 * hostCommit/onCommitted failures are fatal after host work starts: the renderer
 * callbacks revoke their render lease, and this queue disposes its entire model
 * before rejecting. No successful acknowledgement is emitted for that render.
 * Pure admission failures before host work leave the previous commit intact.
 */
export function createDynamicCommitQueue(
  model: Model,
  live: () => boolean,
  hostCommit: (transaction: DynamicChildrenTransaction, current: () => boolean) => Promise<void>,
  onCommitted?: (transaction: DynamicChildrenTransaction) => void
) {
  const queued = new Map<string, Request>();
  let disposed = false;
  let running = false;
  let scheduled = false;
  const current = () => !disposed && live();
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    model.dispose();
    for (const request of queued.values()) request.resolve('disposed');
    queued.clear();
  };
  async function drain() {
    if (running) return;
    scheduled = false;
    running = true;
    try {
      while (queued.size) {
        if (!current()) {
          dispose();
          break;
        }
        const request = queued.values().next().value!;
        queued.delete(request.slot);
        let transaction: DynamicChildrenTransaction | undefined;
        let hostStarted = false;
        try {
          // Admission repeats here: another slot may have committed since enqueue.
          transaction = model.begin(request.slot, request.children);
          const ownsCommit = () => current() && transaction!.isCurrent();
          if (!ownsCommit()) {
            dispose();
            request.resolve('disposed');
            continue;
          }
          hostStarted = true;
          await hostCommit(transaction, ownsCommit);
          if (!ownsCommit()) {
            dispose();
            request.resolve('disposed');
            continue;
          }
          const result = transaction.commit();
          if (result === 'committed') onCommitted?.(transaction);
          request.resolve(result);
        } catch (error) {
          if (hostStarted) dispose();
          else transaction?.cancel();
          request.reject(error);
        }
      }
    } finally {
      running = false;
    }
  }
  return {
    setChildren(slot: string, children: readonly DemoKeyedChild[]): Promise<DemoChildrenCommit> {
      if (!current()) {
        dispose();
        return Promise.resolve('disposed');
      }
      let copied: readonly DemoKeyedChild[];
      try {
        copied = model.validate(slot, children);
      } catch (error) {
        return Promise.reject(error);
      }
      return new Promise((resolve, reject) => {
        const previous = queued.get(slot);
        previous?.resolve('superseded');
        queued.set(slot, { slot, children: copied, resolve, reject });
        if (!running && !scheduled) {
          scheduled = true;
          queueMicrotask(() => {
            void drain();
          });
        }
      });
    },
    dispose,
  };
}
