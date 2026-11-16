import type { OwnedStateHandle } from '@proto.ui/core';
import type { StateEvent, StateSetReason, StateSpec } from '@proto.ui/types';
import { normalizeNumberList, numberListEqual } from './validate';

export type StateKind = StateSpec['kind'];

export type StateId = number;

type Subscriber<V> = (e: StateEvent<V>) => void;

type StateRecord<V> = {
  id: StateId;
  name: string;
  semantic: string;
  spec: StateSpec;
  value: V;
  subscribers: Set<Subscriber<V>>;
};

export class StateKernel {
  private nextId: StateId = 1;
  private records = new Map<StateId, StateRecord<any>>();

  // event queue to make re-entrant set deterministic
  private emitting = false;
  private pending: Array<() => void> = [];

  /** Define a state and return an owned handle. */
  define<V>(name: string, spec: StateSpec, defaultValue: V): OwnedStateHandle<V> {
    if (typeof name !== 'string' || name.length === 0) {
      throw new Error(`[State] state name must be a non-empty string.`);
    }
    const value =
      spec.kind === 'number.list' ? (normalizeNumberList(defaultValue) as V) : defaultValue;
    if (spec.kind === 'number.list') spec = Object.freeze({ kind: 'number.list' });
    const id = this.nextId++;
    const rec: StateRecord<V> = {
      id,
      name,
      semantic: name,
      spec,
      value,
      subscribers: new Set(),
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
    // A registration, rather than callback identity, owns each notification.
    const subscriber: Subscriber<V> = (event) => cb(event);
    rec.subscribers.add(subscriber);
    return () => rec.subscribers.delete(subscriber);
  }

  /** Record source disconnection through the same owner queue as value changes. */
  disconnect(handle: OwnedStateHandle<any>): void {
    const rec = this.getRecord(this.getIdFromHandle(handle));
    this.emit(rec, { type: 'disconnect', reason: 'unmount' });
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

  // ---- byId helpers ----

  private getById<V>(id: StateId): V {
    return this.getRecord<V>(id).value;
  }

  private setDefaultById<V>(id: StateId, v: V): void {
    // setDefault never emits in v0 (setup semantics)
    const rec = this.getRecord<V>(id);
    const next = rec.spec.kind === 'number.list' ? (normalizeNumberList(v) as V) : v;
    if (
      rec.spec.kind === 'number.list' &&
      numberListEqual(rec.value as readonly number[], next as readonly number[])
    )
      return;
    rec.value = next;
  }

  private setById<V>(id: StateId, next: V, reason?: StateSetReason): void {
    const rec = this.getRecord<V>(id);
    const prev = rec.value;
    if (rec.spec.kind === 'number.list') {
      next = normalizeNumberList(next) as V;
      if (numberListEqual(prev as readonly number[], next as readonly number[])) return;
    } else if (Object.is(prev, next)) return;

    rec.value = next;

    this.emit(rec, { type: 'next', prev, next, reason });
  }

  private emit<V>(rec: StateRecord<V>, event: StateEvent<V>): void {
    for (const subscriber of [...rec.subscribers]) {
      Object.defineProperty(this.pending, this.pending.length, {
        value: () => {
          if (rec.subscribers.has(subscriber)) subscriber(event);
        },
        writable: true,
        enumerable: true,
        configurable: true,
      });
    }
    if (this.emitting) return;

    this.emitting = true;
    const failures: unknown[] = [];
    let index = 0;
    try {
      while (index < this.pending.length) {
        const task = this.pending[index++];
        try {
          task();
        } catch (error) {
          Object.defineProperty(failures, failures.length, {
            value: error,
            writable: true,
            enumerable: true,
            configurable: true,
          });
        }
      }
    } finally {
      this.pending.length = 0;
      this.emitting = false;
    }
    if (failures.length === 1) throw failures[0];
    if (failures.length > 1) throw new AggregateError(failures, '[State] subscriber failures');
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
