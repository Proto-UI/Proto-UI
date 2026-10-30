import type {
  DemoPublicInstance,
  DemoPublicInstancesListener,
  DemoPublicInstancesSnapshot,
} from './demo-types';

/** Identity notifications from committed host refs, never a readiness timer or DOM fact probe. */
export function createDemoPublicInstances(options: {
  read(ref: string): DemoPublicInstance | undefined;
  current(): boolean;
  fail(error: unknown): never;
}) {
  type Subscription = {
    refs: readonly string[];
    listener: DemoPublicInstancesListener;
    snapshot: DemoPublicInstancesSnapshot;
    revision: number;
    active: boolean;
  };
  const subscriptions = new Set<Subscription>();
  let alive = true;
  let scheduled = false;
  const snapshot = (refs: readonly string[], current: boolean): DemoPublicInstancesSnapshot => {
    const values: Record<string, DemoPublicInstance | undefined> = Object.create(null);
    for (const ref of refs) values[ref] = current ? options.read(ref) : undefined;
    return Object.freeze(values);
  };
  const deliver = (subscription: Subscription, current: boolean) => {
    if (!subscription.active) return;
    const next = snapshot(subscription.refs, current);
    if (subscription.refs.every((ref) => next[ref] === subscription.snapshot[ref])) return;
    subscription.snapshot = next;
    subscription.revision += 1;
    subscription.listener(next, subscription.revision);
  };
  const retire = () => {
    if (!alive) return;
    alive = false;
    const retiring = [...subscriptions];
    subscriptions.clear();
    const failures: unknown[] = [];
    for (const subscription of retiring) {
      try {
        deliver(subscription, false);
      } catch (error) {
        failures.push(error);
      } finally {
        subscription.active = false;
      }
    }
    if (failures.length === 1) throw failures[0];
    if (failures.length) throw new AggregateError(failures, 'Public instance retirement failed');
  };
  return {
    subscribe(refs: readonly string[], listener: DemoPublicInstancesListener): () => void {
      // A retired owner cannot be revived by a terminal notification's reentry.
      if (!alive || !options.current()) return () => {};
      const names = Object.freeze([...new Set(refs)]);
      let initial: DemoPublicInstancesSnapshot;
      try {
        initial = snapshot(names, true);
      } catch (error) {
        return options.fail(error);
      }
      if (!alive || !options.current()) return () => {};
      const subscription: Subscription = {
        refs: names,
        listener,
        snapshot: initial,
        revision: 0,
        active: true,
      };
      subscriptions.add(subscription);
      try {
        listener(subscription.snapshot, 0);
      } catch (error) {
        subscription.active = false;
        subscriptions.delete(subscription);
        options.fail(error);
      }
      return () => {
        subscription.active = false;
        subscriptions.delete(subscription);
      };
    },
    schedule() {
      if (!alive || scheduled) return;
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        if (!alive) return;
        try {
          if (!options.current()) {
            retire();
            return;
          }
          for (const subscription of [...subscriptions]) {
            if (!alive || !options.current()) break;
            deliver(subscription, true);
          }
        } catch (error) {
          // The host revokes its lease and runs all teardown steps before surfacing failure.
          options.fail(error);
        }
      });
    },
    retire,
  };
}

/** Preserve Vue2's original vnode-hook receiver/arguments, including on failure. */
export function appendDemoPublicInstanceHook(
  hook: ((...args: any[]) => void) | undefined,
  schedule: () => void
): (...args: any[]) => void {
  return function (this: unknown, ...args: any[]) {
    try {
      hook?.apply(this, args);
    } finally {
      schedule();
    }
  };
}
