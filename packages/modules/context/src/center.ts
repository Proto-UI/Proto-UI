// packages/modules/context/src/center.ts
import type { ContextKey, JsonObject } from '@proto.ui/types';
import type { ContextCallbackTask, ContextProviderEntry, ContextSubscriptionEntry } from './types';
import type { ContextInstanceToken, ContextParentGetter } from './caps';

export type SubscriptionMode = 'required' | 'optional';
export type ContextResolution = 'self' | 'ancestor';

export type ContextCallback<T extends JsonObject> = (
  ctx: unknown,
  next: T | null,
  prev: T | null,
  isCurrent?: () => boolean
) => void;

type SubscriptionRecord = {
  mode: SubscriptionMode;
  callbacks: Array<ContextCallback<any>>;
};

type Delivery = {
  next: JsonObject;
  prev: JsonObject;
  ctx: unknown;
  getParent: ContextParentGetter;
  recipients: Array<{
    instance: ContextInstanceToken;
    resolution: ContextResolution;
    record: SubscriptionRecord;
    callbacks: Array<ContextCallback<any>>;
  }>;
};
type DispatchChannel = { pending: Delivery[]; draining: boolean };

export class ContextCenter {
  private readonly providers = new Map<ContextKey<any>, Map<ContextInstanceToken, JsonObject>>();

  private readonly subscriptions = new Map<
    ContextInstanceToken,
    Map<ContextKey<any>, SubscriptionRecord>
  >();

  private readonly ancestorSubscriptions = new Map<
    ContextInstanceToken,
    Map<ContextKey<any>, SubscriptionRecord>
  >();

  private subscriptionStore(resolution: ContextResolution) {
    return resolution === 'ancestor' ? this.ancestorSubscriptions : this.subscriptions;
  }

  private callbackQueue: ContextCallbackTask[] = [];
  // One queue per provider lifetime/key, not a process-wide scheduling policy.
  private readonly channels = new Map<
    ContextKey<any>,
    Map<ContextInstanceToken, DispatchChannel>
  >();

  // -------------------------
  // providers
  // -------------------------

  provide(instance: ContextInstanceToken, key: ContextKey<any>, value: JsonObject) {
    let byKey = this.providers.get(key);
    if (!byKey) {
      byKey = new Map();
      this.providers.set(key, byKey);
    }

    if (byKey.has(instance)) {
      throw new Error(`[Context] duplicate provide for key: ${key?.debugName ?? '(unknown)'}`);
    }

    byKey.set(instance, value);
    let channels = this.channels.get(key);
    if (!channels) this.channels.set(key, (channels = new Map()));
    channels.set(instance, { pending: [], draining: false });
  }

  unprovide(instance: ContextInstanceToken, key: ContextKey<any>): void {
    const byKey = this.providers.get(key);
    if (!byKey) return;
    byKey.delete(instance);
    if (byKey.size === 0) this.providers.delete(key);
    const channels = this.channels.get(key);
    const channel = channels?.get(instance);
    if (channel) channel.pending.length = 0;
    channels?.delete(instance);
    if (channels?.size === 0) this.channels.delete(key);
  }

  getProviderValue(instance: ContextInstanceToken, key: ContextKey<any>): JsonObject | null {
    const byKey = this.providers.get(key);
    if (!byKey) return null;
    return (byKey.get(instance) as JsonObject) ?? null;
  }

  // -------------------------
  // subscriptions
  // -------------------------

  subscribe(
    instance: ContextInstanceToken,
    key: ContextKey<any>,
    mode: SubscriptionMode,
    cb?: ContextCallback<any>,
    resolution: ContextResolution = 'self'
  ): () => void {
    const subscriptions = this.subscriptionStore(resolution);
    let byInstance = subscriptions.get(instance);
    if (!byInstance) {
      byInstance = new Map();
      subscriptions.set(instance, byInstance);
    }

    let record = byInstance.get(key);
    if (record) {
      if (record.mode !== mode) {
        throw new Error(
          `[Context] subscription mode mismatch for key: ${key?.debugName ?? '(unknown)'}`
        );
      }
    } else {
      record = { mode, callbacks: [] };
      byInstance.set(key, record);
    }
    if (cb) record.callbacks.push(cb);
    return () => {
      if (!cb) return;
      const index = record.callbacks.indexOf(cb);
      if (index !== -1) record.callbacks.splice(index, 1);
    };
  }

  hasSubscription(
    instance: ContextInstanceToken,
    key: ContextKey<any>,
    mode?: SubscriptionMode,
    resolution: ContextResolution = 'self'
  ): boolean {
    const byInstance = this.subscriptionStore(resolution).get(instance);
    if (!byInstance) return false;
    const rec = byInstance.get(key);
    if (!rec) return false;
    if (!mode) return true;
    return rec.mode === mode;
  }

  // -------------------------
  // provider resolution
  // -------------------------

  resolveProvider(
    consumer: ContextInstanceToken,
    key: ContextKey<any>,
    getParent: ContextParentGetter,
    resolution: ContextResolution = 'self'
  ): ContextInstanceToken | null {
    const byKey = this.providers.get(key);
    if (!byKey) return null;

    let cur: ContextInstanceToken | null =
      resolution === 'ancestor' ? getParent(consumer) : consumer;
    while (cur !== null) {
      if (byKey.has(cur)) return cur;
      cur = getParent(cur);
    }
    return null;
  }

  // -------------------------
  // updates & notifications
  // -------------------------

  updateFromProvider(
    provider: ContextInstanceToken,
    key: ContextKey<any>,
    next: JsonObject,
    ctx: unknown,
    getParent: ContextParentGetter
  ): void {
    const byKey = this.providers.get(key);
    if (!byKey || !byKey.has(provider)) {
      throw new Error(
        `[Context] update on missing provider for key: ${key?.debugName ?? '(unknown)'}`
      );
    }

    const prev = byKey.get(provider) as JsonObject;
    byKey.set(provider, next);

    this.dispatch(provider, key, next, prev, ctx, getParent);
  }

  updateFromConsumer(
    consumer: ContextInstanceToken,
    key: ContextKey<any>,
    next: JsonObject,
    ctx: unknown,
    getParent: ContextParentGetter
  ): boolean {
    const provider = this.resolveProvider(consumer, key, getParent);
    if (provider === null) return false;

    this.updateFromProvider(provider, key, next, ctx, getParent);
    return true;
  }

  private dispatch(
    provider: ContextInstanceToken,
    key: ContextKey<any>,
    next: JsonObject,
    prev: JsonObject,
    ctx: unknown,
    getParent: ContextParentGetter
  ): void {
    const channel = this.channels.get(key)!.get(provider)!;
    const recipients: Delivery['recipients'] = [];
    for (const resolution of ['self', 'ancestor'] as const) {
      for (const [instance, byKey] of this.subscriptionStore(resolution)) {
        const rec = byKey.get(key);
        if (!rec || rec.callbacks.length === 0) continue;
        const bound = this.resolveProvider(instance, key, getParent, resolution);
        // SameValueZero must agree with Map identity, including NaN providers.
        if (bound !== provider && !Object.is(bound, provider)) continue;
        recipients.push({ instance, resolution, record: rec, callbacks: [...rec.callbacks] });
      }
    }
    channel.pending.push({ next, prev, ctx, getParent, recipients });
    if (channel.draining) return;
    channel.draining = true;
    const errors: unknown[] = [];
    try {
      while (channel.pending.length) {
        const delivery = channel.pending.shift()!;
        for (const { instance, resolution, record, callbacks } of delivery.recipients) {
          const task: ContextCallbackTask = {
            instance,
            key,
            next: delivery.next,
            prev: delivery.prev,
            callbackCount: callbacks.length,
            ...(resolution === 'ancestor' ? { resolution } : {}),
          };
          this.callbackQueue.push(task);
          try {
            for (const cb of callbacks) {
              // Re-check between callbacks: a previous callback can dispose,
              // replace or rebind either participant in the current delivery.
              const isCurrent = () => {
                if (this.channels.get(key)?.get(provider) !== channel) return false;
                if (this.subscriptionStore(resolution).get(instance)?.get(key) !== record)
                  return false;
                if (!record.callbacks.includes(cb)) return false;
                const bound = this.resolveProvider(instance, key, delivery.getParent, resolution);
                return bound === provider || Object.is(bound, provider);
              };
              if (!isCurrent()) continue;
              try {
                cb(delivery.ctx, delivery.next, delivery.prev, isCurrent);
              } catch (error) {
                errors.push(error);
              }
            }
          } finally {
            this.callbackQueue.splice(this.callbackQueue.indexOf(task), 1);
          }
        }
      }
    } finally {
      channel.pending.length = 0;
      channel.draining = false;
    }
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) throw new AggregateError(errors, '[Context] callback delivery failed');
  }

  // -------------------------
  // diagnostics
  // -------------------------

  dumpProviders(): ContextProviderEntry[] {
    const out: ContextProviderEntry[] = [];
    for (const [key, byInstance] of this.providers.entries()) {
      for (const [instance, value] of byInstance.entries()) {
        out.push({ instance, key, value });
      }
    }
    return out;
  }

  dumpSubscriptions(): ContextSubscriptionEntry[] {
    const out: ContextSubscriptionEntry[] = [];
    for (const resolution of ['self', 'ancestor'] as const) {
      for (const [instance, byKey] of this.subscriptionStore(resolution)) {
        for (const [key, rec] of byKey) {
          out.push({
            instance,
            key,
            mode: rec.mode,
            callbackCount: rec.callbacks.length,
            ...(resolution === 'ancestor' ? { resolution } : {}),
          });
        }
      }
    }
    return out;
  }

  dumpCallbackQueue(): ContextCallbackTask[] {
    return [...this.callbackQueue];
  }

  // -------------------------
  // lifecycle
  // -------------------------

  removeInstance(instance: ContextInstanceToken): void {
    // remove subscriptions
    this.subscriptions.delete(instance);
    this.ancestorSubscriptions.delete(instance);

    // remove providers
    for (const key of this.providers.keys()) this.unprovide(instance, key);
  }
}

// v0: singleton center (module scope is still per instance, but data is shared)
export const CONTEXT_CENTER = new ContextCenter();
