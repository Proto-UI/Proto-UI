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

  // The kernel owns notification ordering and registration identity. The module
  // only tracks the subscriptions it must release and injects callback context.
  private watchedSlots = new Map<
    number,
    { handle: OwnedStateHandle<any>; subscriptions: Set<() => void> }
  >();

  /**
   * ctx stack for nested set() calls (re-entrant set in watch callbacks, etc.)
   * The runtime dispatcher supplies the owning callback run. Without a dispatcher,
   * queued reentrant notifications retain the outer synchronous set-chain context.
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

  private addWatcher<V>(
    handle: OwnedStateHandle<V>,
    cb: InternalStateWatchCallback<V>
  ): () => void {
    const id = getIdFromHandle(handle);
    const unsubscribe = this.kernel.subscribe(handle, (event) => {
      if (this.disposed) {
        // Terminal disconnect historically has no live callback scope.
        if (event.type === 'disconnect') cb(undefined, event);
        return;
      }
      this.dispatchWatcher(cb, this.currentCtx(), event);
    });
    let slot = this.watchedSlots.get(id);
    if (!slot) {
      slot = { handle, subscriptions: new Set() };
      this.watchedSlots.set(id, slot);
    }
    slot.subscriptions.add(unsubscribe);
    return () => {
      unsubscribe();
      slot.subscriptions.delete(unsubscribe);
      if (slot.subscriptions.size === 0 && this.watchedSlots.get(id) === slot) {
        this.watchedSlots.delete(id);
      }
    };
  }

  private emitDisconnect(handle: OwnedStateHandle<any>): void {
    this.kernel.disconnect(handle);
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

    numberList: (semantic, defaultValue) => {
      const raw = this.kernel.define<readonly number[]>(
        semantic,
        { kind: 'number.list' },
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

    const failures: unknown[] = [];
    try {
      for (const { handle } of Array.from(this.watchedSlots.values())) {
        try {
          this.emitDisconnect(handle);
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
      for (const { subscriptions } of this.watchedSlots.values()) {
        for (const unsubscribe of subscriptions) unsubscribe();
      }
      this.watchedSlots.clear();
      this.ctxStack = [];
      this.kernel.dispose();
    }
    if (failures.length === 1) throw failures[0];
    if (failures.length > 1) throw new AggregateError(failures, '[State] disconnect failures');
  }
}
