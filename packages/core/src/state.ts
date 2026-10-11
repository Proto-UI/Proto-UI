// packages/core/src/state.ts
// ---- Component-author side handles (governed by Proto UI) ----
import {
  EnumStateDefineSpec,
  NumberDiscreteStateDefineSpec,
  NumberRangeStateDefineSpec,
  PropsBaseType,
  StateSpec,
  StateSetReason,
  StringStateDefineSpec,
} from '@proto.ui/types';
import { StateSubscribeCallback, StateWatchCallback } from './handles';

export type Unsubscribe = () => void;

export type InteractionStateName = 'disabled' | 'hovered' | 'pressed' | 'focused' | 'focusVisible';

export type AccessibilityStateName = 'expanded' | 'invalid' | 'selected' | 'checked' | 'current';

/** Owned: author has "design authority". No watch (intentional friction). */
export interface OwnedStateHandle<V> {
  /** setup+runtime */
  get(): V;

  /** setup-only (guarded by runtime) */
  setDefault(v: V): void;

  /** runtime-only (guarded by runtime) */
  set(v: V, reason?: StateSetReason): void;
}

/** Borrowed: typically from asHook import; may be influenced by side effects. */
export interface BorrowedStateHandle<V, P extends PropsBaseType> extends OwnedStateHandle<V> {
  /**
   * register: setup-only (guarded)
   * invoke: runtime-only (by contract, state changes won't trigger in setup)
   */
  watch(cb: StateWatchCallback<V, P>): Unsubscribe;
}

/** Observed: no design authority, but may be uncontrolled -> watch allowed. */
export interface ObservedStateHandle<V, P extends PropsBaseType> {
  get(): V;
  watch(cb: StateWatchCallback<V, P>): Unsubscribe;
}

// ---- App-maker side projection (expose + state joint API) ----
// 这个建议放 @proto.ui/types 也行，但放 core 也不破依赖图；
// 不过 types 更适合作为 Exposes 泛型的公共约束。
// 先写 core 里版本，后续你决定挪走。
export interface ExposedStateHandle<V> {
  get(): V;
  subscribe(cb: StateSubscribeCallback<V>): Unsubscribe;
  unsubscribe(off: Unsubscribe): void;
  spec: StateSpec;
}

export interface StateDefAPI {
  bool(semantic: string, defaultValue: boolean): OwnedStateHandle<boolean>;

  fromInteraction<P extends PropsBaseType = PropsBaseType>(
    name: InteractionStateName
  ): BorrowedStateHandle<boolean, P>;

  fromAccessibility<P extends PropsBaseType = PropsBaseType>(
    name: AccessibilityStateName
  ): BorrowedStateHandle<boolean, P>;

  enum<const O extends readonly string[]>(
    semantic: string,
    defaultValue: O[number],
    spec: EnumStateDefineSpec<O>
  ): OwnedStateHandle<O[number]>;

  /**
   * string state currently doesn't promise literal narrowing by options,
   * but we still accept options for runtime validation / UI mapping.
   */
  string(
    semantic: string,
    defaultValue: string,
    spec?: StringStateDefineSpec
  ): OwnedStateHandle<string>;

  numberRange(
    semantic: string,
    defaultValue: number,
    spec: NumberRangeStateDefineSpec
  ): OwnedStateHandle<number>;

  /** Draft immutable finite-number snapshots; empty values and duplicates are valid. */
  numberList(
    semantic: string,
    defaultValue: readonly number[]
  ): OwnedStateHandle<readonly number[]>;

  numberDiscrete(
    semantic: string,
    defaultValue: number,
    spec?: NumberDiscreteStateDefineSpec
  ): OwnedStateHandle<number>;
}

export type State<V> =
  | OwnedStateHandle<V>
  | BorrowedStateHandle<V, any>
  | ObservedStateHandle<V, any>;
