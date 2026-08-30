import type { ModuleInstance, OwnedStateHandle, Unsubscribe } from '@proto.ui/core';
import type {
  EnumStateDefineSpec,
  StringStateDefineSpec,
  NumberRangeStateDefineSpec,
  NumberDiscreteStateDefineSpec,
  StateEvent,
} from '@proto.ui/types';

export type InternalStateWatchCallback<V> = (ctx: unknown, e: StateEvent<V>) => void;

export type StateCallbackDispatcher = (fn: (ctx: unknown) => void) => void;

export type StatePort = {
  /**
   * Runtime-owned bridge that dispatches watch callbacks in the owning
   * instance's callback scope, including mutations initiated by privileged
   * module ports while the kernel itself is otherwise idle.
   */
  setCallbackDispatcher(dispatch: StateCallbackDispatcher): void;

  /**
   * Internal watch API (ctx is opaque to state-module; runtime injects it).
   *
   * - internal bridge API; author-facing watch views enforce setup-only separately
   * - invoke happens during runtime set(), and ctx should reflect the current callback context
   */
  watch<V>(handle: OwnedStateHandle<V>, cb: InternalStateWatchCallback<V>): Unsubscribe;

  /**
   * Register setup-time validation that runs before a state value is committed
   * or any watcher is notified.
   */
  beforeSet?<V>(handle: OwnedStateHandle<V>, validator: (prev: V, next: V) => void): Unsubscribe;

  /**
   * Emit a disconnect event to all watchers of this state slot.
   * Intended for terminal disposal or an explicit semantic-source disconnect.
   * Repeatable view detachment must preserve instance-owned State resources.
   */
  disconnect(handle: OwnedStateHandle<any>): void;

  /**
   * Internal module-owned mutation path.
   *
   * This bypasses author-facing phase guards and is intended for runtime modules
   * that maintain official state facts.
   */
  set<V>(handle: OwnedStateHandle<V>, value: V, reason?: unknown, ctx?: unknown): void;

  /**
   * Internal module-owned default mutation path. Does not emit.
   */
  setDefault<V>(handle: OwnedStateHandle<V>, value: V): void;

  /**
   * Create an internal "observed" view for a slot.
   * This is NOT the component-author facing ObservedStateHandle type (that one is typed with RunHandle<P>),
   * but it's sufficient for internal modules that only need get+watch with opaque ctx.
   */
  createObservedHandle<V>(handle: OwnedStateHandle<V>): {
    get(): V;
    watch(cb: InternalStateWatchCallback<V>): Unsubscribe;
  };

  /**
   * Create an internal "borrowed" view for a slot (get+set+setDefault+watch).
   * Again: internal-only, opaque ctx.
   */
  createBorrowedHandle<V>(handle: OwnedStateHandle<V>): {
    get(): V;
    setDefault(v: V): void;
    set(v: V, reason?: unknown): void;
    watch(cb: InternalStateWatchCallback<V>): Unsubscribe;
  };
};

export type StateFacade = {
  bool: (semantic: string, defaultValue: boolean) => OwnedStateHandle<boolean>;

  enum: <O extends readonly string[]>(
    semantic: string,
    defaultValue: O[number],
    spec: EnumStateDefineSpec<O>
  ) => OwnedStateHandle<O[number]>;

  string: (
    semantic: string,
    defaultValue: string,
    spec?: StringStateDefineSpec
  ) => OwnedStateHandle<string>;

  numberRange: (
    semantic: string,
    defaultValue: number,
    spec: NumberRangeStateDefineSpec
  ) => OwnedStateHandle<number>;

  numberDiscrete: (
    semantic: string,
    defaultValue: number,
    spec?: NumberDiscreteStateDefineSpec
  ) => OwnedStateHandle<number>;
};

export type StateModule = ModuleInstance<StateFacade> & {
  name: 'state';
  scope: 'instance';
};
