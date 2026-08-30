import type { OwnedStateHandle } from '@proto.ui/core';
import type { SystemCaps } from '@proto.ui/module-base';
import type { StateEvent, StateSetReason } from '@proto.ui/types';

import { StateKernel } from './kernel';
import type {
  InternalStateWatchCallback,
  StateCallbackDispatcher,
  StateFacade,
  StatePort,
} from './types';

function opOf(semantic: string, method: string) {
  return `state(${semantic}).${method}`;
}

function getIdFromHandle(handle: OwnedStateHandle<any>): number {
  const id = (handle as any).__stateId as number | undefined;
  if (!id) throw new Error(`[StateModule] expects handle created by state-kernel`);
  return id;
}

export class StateModuleImpl {
  readonly kernel = new StateKernel();
  private disposed = false;

  /**
   * watchersById stores internal watchers that need ctx injection.
   * We keep it in module layer to avoid coupling kernel to runtime context.
   */
  private watchersById = new Map<number, Set<InternalStateWatchCallback<any>>>();

  /**
   * For each state slot id that has at least one watcher, we keep exactly one kernel subscription
   * and fan-out to watchersById.
   */
  private kernelOffById = new Map<number, () => void>();

  /**
   * ctx stack for nested set() calls (re-entrant set in watch callbacks, etc.)
   * kernel already queues emits deterministically; this stack ensures we always forward
   * the correct ctx for the current "set chain".
   */
  private ctxStack: unknown[] = [];
  private callbackDispatcher: StateCallbackDispatcher | null = null;

  constructor(private readonly sys: SystemCaps) {}

  // -----------------------
  // internal guards
  // -----------------------

  private ensureAlive(op: string): void {
    this.sys.ensureNotDisposed(op);
    if (this.disposed) {
      // Important: module-local disposed must also block usage even if runtime sys isn't disposed yet.
      throw new Error(`[StateModule] disposed. op=${op}`);
    }
  }

  private getCallbackCtx(): unknown {
    return (
      (this.sys as any).getCallbackCtx?.() ??
      (this.sys as any).getCurrentCallbackCtx?.() ??
      (this.sys as any).getRun?.() ??
      undefined
    );
  }

  // -----------------------
  // ctx helpers
  // -----------------------

  private withCtx<T>(ctx: unknown, fn: () => T): T {
    this.ctxStack.push(ctx);
    try {
      return fn();
    } finally {
      this.ctxStack.pop();
    }
  }

  private currentCtx(): unknown {
    return this.ctxStack.length ? this.ctxStack[this.ctxStack.length - 1] : undefined;
  }

  private dispatchWatcher<V>(
    cb: InternalStateWatchCallback<V>,
    ctx: unknown,
    event: StateEvent<V>
  ): void {
    if (this.callbackDispatcher) {
      this.callbackDispatcher((callbackCtx) => cb(callbackCtx, event));
      return;
    }
    cb(ctx, event);
  }

  // -----------------------
  // watcher plumbing
  // -----------------------

  private ensureKernelForwarder<V>(id: number, handle: OwnedStateHandle<V>): void {
    if (this.kernelOffById.has(id)) return;

    const off = this.kernel.subscribe(handle, (e: StateEvent<V>) => {
      const watchers = this.watchersById.get(id);
      if (!watchers || watchers.size === 0) return;

      const ctx = this.currentCtx();
      // Snapshot for safety if callbacks mutate watcher sets
      const list = Array.from(watchers);
      for (const cb of list) this.dispatchWatcher(cb, ctx, e);
    });

    this.kernelOffById.set(id, off);
  }

  private addWatcher<V>(
    handle: OwnedStateHandle<V>,
    cb: InternalStateWatchCallback<V>
  ): () => void {
    const id = getIdFromHandle(handle);

    let set = this.watchersById.get(id);
    if (!set) {
      set = new Set();
      this.watchersById.set(id, set);
    }
    set.add(cb as any);

    this.ensureKernelForwarder(id, handle);

    return () => {
      const s = this.watchersById.get(id);
      if (!s) return;
      s.delete(cb as any);

      if (s.size === 0) {
        this.watchersById.delete(id);

        // Optional: remove kernel forwarder when no watchers remain
        const off = this.kernelOffById.get(id);
        if (off) {
          off();
          this.kernelOffById.delete(id);
        }
      }
    };
  }

  private emitDisconnect(handle: OwnedStateHandle<any>): void {
    const id = getIdFromHandle(handle);
    const watchers = this.watchersById.get(id);
    if (!watchers || watchers.size === 0) return;

    const e: StateEvent<any> = { type: 'disconnect', reason: 'unmount' };
    const ctx = this.currentCtx();
    const list = Array.from(watchers);
    for (const cb of list) this.dispatchWatcher(cb, ctx, e);
  }

  // -----------------------
  // handle wrapping
  // -----------------------

  private wrapOwnedHandle<V>(raw: OwnedStateHandle<V>, semantic: string): OwnedStateHandle<V> {
    const wrapped: OwnedStateHandle<V> = {
      get: () => {
        this.ensureAlive(opOf(semantic, 'get'));
        return raw.get();
      },

      setDefault: (v) => {
        // setup-only policy lives in sys
        this.ensureAlive(opOf(semantic, 'setDefault'));
        this.sys.ensureSetup(opOf(semantic, 'setDefault'));
        return raw.setDefault(v);
      },

      set: (v, reason?: StateSetReason) => {
        // callback-only policy lives in sys
        this.ensureAlive(opOf(semantic, 'set'));
        this.sys.ensureCallback(opOf(semantic, 'set'));

        const ctx = this.getCallbackCtx();
        return this.withCtx(ctx, () => raw.set(v, reason));
      },
    };

    (wrapped as any).__stateId = (raw as any).__stateId;
    (wrapped as any).__stateName = (raw as any).__stateName ?? semantic;
    (wrapped as any).__stateSemantic = (raw as any).__stateSemantic ?? semantic;
    (wrapped as any).__stateKind = (raw as any).__stateKind;
    (wrapped as any).__stateSpec = (raw as any).__stateSpec;

    return wrapped;
  }

  // -----------------------
  // port
  // -----------------------

  readonly port: StatePort = {
    setCallbackDispatcher: (dispatch) => {
      this.callbackDispatcher = dispatch;
    },

    watch: (handle, cb) => {
      this.ensureAlive(`state.port.watch`);
      return this.addWatcher(handle, cb);
    },

    beforeSet: (handle, validator) => {
      this.ensureAlive(`state.port.beforeSet`);
      this.sys.ensureSetup(`state.port.beforeSet`);
      return this.kernel.beforeSet(handle, validator);
    },

    disconnect: (handle) => {
      this.ensureAlive(`state.port.disconnect`);
      this.emitDisconnect(handle);
    },

    set: (handle, value, reason, ctx) => {
      this.ensureAlive(`state.port.set`);
      return this.withCtx(ctx ?? this.getCallbackCtx(), () =>
        this.kernel.setInternal(handle, value, reason as any)
      );
    },

    setDefault: (handle, value) => {
      this.ensureAlive(`state.port.setDefault`);
      return this.kernel.setDefaultInternal(handle, value);
    },

    createObservedHandle: (handle) => {
      this.ensureAlive(`state.port.createObservedHandle`);
      const observed = {
        get: () => {
          this.ensureAlive(`state.port.createObservedHandle.get`);
          return handle.get();
        },
        watch: (cb: InternalStateWatchCallback<any>) => {
          this.ensureAlive(`state.port.createObservedHandle.watch`);
          this.sys.ensureSetup(`state.port.createObservedHandle.watch`);
          return this.addWatcher(handle, cb);
        },
      };

      (observed as any).__stateId = (handle as any).__stateId;
      (observed as any).__stateName = (handle as any).__stateName;
      (observed as any).__stateSemantic = (handle as any).__stateSemantic;
      (observed as any).__stateKind = (handle as any).__stateKind;
      (observed as any).__stateSpec = (handle as any).__stateSpec;

      return observed;
    },

    createBorrowedHandle: (handle) => {
      this.ensureAlive(`state.port.createBorrowedHandle`);
      const borrowed = {
        get: () => {
          this.ensureAlive(`state.port.createBorrowedHandle.get`);
          return handle.get();
        },
        setDefault: (v: unknown) => {
          this.ensureAlive(`state.port.createBorrowedHandle.setDefault`);
          return handle.setDefault(v as any);
        },
        set: (v: unknown, reason?: unknown) => {
          this.ensureAlive(`state.port.createBorrowedHandle.set`);
          const ctx = this.getCallbackCtx();
          return this.withCtx(ctx, () => handle.set(v as any, reason as any));
        },
        watch: (cb: InternalStateWatchCallback<any>) => {
          this.ensureAlive(`state.port.createBorrowedHandle.watch`);
          this.sys.ensureSetup(`state.port.createBorrowedHandle.watch`);
          return this.addWatcher(handle, cb);
        },
      };
      (borrowed as any).__stateId = (handle as any).__stateId;
      (borrowed as any).__stateName = (handle as any).__stateName;
      (borrowed as any).__stateSemantic = (handle as any).__stateSemantic;
      (borrowed as any).__stateKind = (handle as any).__stateKind;
      (borrowed as any).__stateSpec = (handle as any).__stateSpec;
      return borrowed;
    },
  };

  // -----------------------
  // facade
  // -----------------------

  readonly facade: StateFacade = {
    bool: (semantic, defaultValue) => {
      const raw = this.kernel.define<boolean>(semantic, { kind: 'bool' }, defaultValue);
      return this.wrapOwnedHandle(raw, semantic);
    },

    enum: (semantic, defaultValue, spec) => {
      const raw = this.kernel.define<any>(
        semantic,
        { kind: 'enum', ...spec },
        defaultValue as any
      ) as OwnedStateHandle<any>;
      return this.wrapOwnedHandle(raw, semantic) as any;
    },

    string: (semantic, defaultValue, spec = {}) => {
      const raw = this.kernel.define<string>(semantic, { kind: 'string', ...spec }, defaultValue);
      return this.wrapOwnedHandle(raw, semantic);
    },

    numberRange: (semantic, defaultValue, spec) => {
      const raw = this.kernel.define<number>(
        semantic,
        { kind: 'number.range', ...spec },
        defaultValue
      );
      return this.wrapOwnedHandle(raw, semantic);
    },

    numberDiscrete: (semantic, defaultValue, spec = {}) => {
      const raw = this.kernel.define<number>(
        semantic,
        { kind: 'number.discrete', ...spec },
        defaultValue
      );
      return this.wrapOwnedHandle(raw, semantic);
    },
  };

  // -----------------------
  // lifecycle
  // -----------------------

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    // Emit disconnect for all watched slots (best-effort).
    for (const [, watchers] of this.watchersById) {
      const e: StateEvent<any> = { type: 'disconnect', reason: 'unmount' };
      const list = Array.from(watchers);
      for (const cb of list) cb(undefined, e);
    }

    // cleanup kernel subscriptions
    for (const [, off] of this.kernelOffById) off();
    this.kernelOffById.clear();
    this.watchersById.clear();
    this.ctxStack = [];

    this.kernel.dispose();
  }
}
