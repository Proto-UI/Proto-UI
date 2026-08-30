import type { OwnedStateHandle } from '@proto.ui/core';
import type { StateEvent, StateSetReason, StateSpec } from '@proto.ui/types';

export type StateKind = 'bool' | 'enum' | 'string' | 'number.range' | 'number.discrete';

export type StateId = number;

type Subscriber<V> = (e: StateEvent<V>) => void;

type StateRecord<V> = {
  id: StateId;
  name: string;
  semantic: string;
  spec: StateSpec;
  value: V;
  subscribers: Set<Subscriber<V>>;
  beforeSet: Set<(prev: V, next: V) => void>;
};

class StateValidationFailure {
  constructor(readonly error: unknown) {}
}

export class StateKernel {
  private nextId: StateId = 1;
  private records = new Map<StateId, StateRecord<any>>();

  // event queue to make re-entrant set deterministic
  private emitting = false;
  private pending: Array<() => void> = [];

  private transactionSnapshot: Map<StateId, unknown> | null = null;

  /** Define a state and return an owned handle. */
  define<V>(name: string, spec: StateSpec, defaultValue: V): OwnedStateHandle<V> {
    if (typeof name !== 'string' || name.length === 0) {
      throw new Error(`[State] state name must be a non-empty string.`);
    }
    const id = this.nextId++;
    const rec: StateRecord<V> = {
      id,
      name,
      semantic: name,
      spec,
      value: defaultValue,
      subscribers: new Set(),
      beforeSet: new Set(),
    };
    this.records.set(id, rec);

    const h: OwnedStateHandle<V> = {
      get: () => this.getById<V>(id),
      setDefault: (v) => {
        // setup-only is enforced by runtime; kernel stays pure
        this.setDefaultById<V>(id, v);
      },
      set: (v, reason) => {
        // runtime-only is enforced by runtime; kernel stays pure
        this.setById<V>(id, v, reason);
      },
    };

    // attach metadata for internal ops/debug (non-typed)
    (h as any).__stateId = id;
    (h as any).__stateName = name;
    (h as any).__stateSemantic = name;
    (h as any).__stateKind = spec.kind;
    (h as any).__stateSpec = spec;

    return h;
  }

  /** Internal: subscribe to state changes (v0: for tests & future modules). */
  subscribe<V>(handle: OwnedStateHandle<V>, cb: Subscriber<V>): () => void {
    const id = this.getIdFromHandle(handle);
    const rec = this.getRecord<V>(id);
    rec.subscribers.add(cb);
    return () => rec.subscribers.delete(cb);
  }

  /** Internal: get semantic from a handle. */
  getSemantic(handle: OwnedStateHandle<any>): string {
    const id = this.getIdFromHandle(handle);
    return this.getRecord<any>(id).semantic;
  }

  /** Internal: get kind from a handle. */
  getKind(handle: OwnedStateHandle<any>): StateKind {
    const id = this.getIdFromHandle(handle);
    return this.getRecord<any>(id).spec.kind as StateKind;
  }

  /** Internal module mutation path. Module ports enforce access boundaries. */
  setInternal<V>(handle: OwnedStateHandle<V>, next: V, reason?: StateSetReason): void {
    const id = this.getIdFromHandle(handle);
    this.setById<V>(id, next, reason);
  }

  /** Internal setup/default mutation path. Does not emit. */
  setDefaultInternal<V>(handle: OwnedStateHandle<V>, next: V): void {
    const id = this.getIdFromHandle(handle);
    this.setDefaultById<V>(id, next);
  }

  /** Register setup-time validation that runs before a value is committed. */
  beforeSet<V>(handle: OwnedStateHandle<V>, validator: (prev: V, next: V) => void): () => void {
    const id = this.getIdFromHandle(handle);
    const rec = this.getRecord<V>(id);
    rec.beforeSet.add(validator);
    return () => rec.beforeSet.delete(validator);
  }

  // ---- byId helpers ----

  private getById<V>(id: StateId): V {
    return this.getRecord<V>(id).value;
  }

  private setDefaultById<V>(id: StateId, v: V): void {
    // setDefault never emits in v0 (setup semantics)
    const rec = this.getRecord<V>(id);
    rec.value = v;
  }

  private setById<V>(id: StateId, next: V, reason?: StateSetReason): void {
    const rec = this.getRecord<V>(id);
    const prev = rec.value;
    if (Object.is(prev, next)) return;

    const isTransactionRoot = !this.emitting && !this.transactionSnapshot;

    try {
      for (const validator of rec.beforeSet) validator(prev, next);
    } catch (error) {
      if (this.emitting) throw new StateValidationFailure(error);
      throw error;
    }

    if (isTransactionRoot) this.transactionSnapshot = this.snapshotValues();

    rec.value = next;

    const emit = () => {
      // Align with @proto.ui/types StateEvent<V> union
      const e: StateEvent<V> = { type: 'next', prev, next, reason };
      for (const cb of rec.subscribers) cb(e);
    };

    if (this.emitting) {
      this.pending.push(emit);
      return;
    }

    this.emitting = true;
    let failure: { error: unknown; validation: boolean } | null = null;

    const invoke = (task: () => void): { error: unknown; validation: boolean } | null => {
      try {
        task();
        return null;
      } catch (error) {
        return {
          error: error instanceof StateValidationFailure ? error.error : error,
          validation: error instanceof StateValidationFailure,
        };
      }
    };

    try {
      const first = invoke(emit);
      if (first) failure = first;
      // Drain re-entrant events even when a subscriber throws, so recorded
      // transitions are not lost; stop only on a validation failure, which
      // must roll the whole transaction back.
      while (this.pending.length && !failure?.validation) {
        const result = invoke(this.pending.shift()!);
        if (result && !failure) failure = result;
        else if (result?.validation && failure && !failure.validation) failure = result;
      }
      if (failure?.validation) {
        this.restoreTransaction();
        this.pending.length = 0;
      }
      if (failure) throw failure.error;
    } finally {
      this.emitting = false;
      this.transactionSnapshot = null;
    }
  }
  private snapshotValues(): Map<StateId, unknown> {
    return new Map(
      Array.from(this.records.entries(), ([id, record]) => [id, record.value] as const)
    );
  }

  private restoreTransaction(): void {
    if (!this.transactionSnapshot) return;
    for (const [id, value] of this.transactionSnapshot) {
      const record = this.records.get(id);
      if (record) record.value = value;
    }
  }
  private getIdFromHandle(handle: OwnedStateHandle<any>): StateId {
    const id = (handle as any).__stateId as StateId | undefined;
    if (!id) {
      throw new Error(`[StateKernel] expects handle created by this kernel`);
    }
    return id;
  }

  private getRecord<V>(id: StateId): StateRecord<V> {
    const rec = this.records.get(id);
    if (!rec) throw new Error(`[StateKernel] unknown state id: ${id}`);
    return rec as StateRecord<V>;
  }

  /** cleanup all internal state */
  dispose(): void {
    this.records.clear();
    this.pending = [];
    this.emitting = false;
  }
}
