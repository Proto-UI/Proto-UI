// packages/types/src/state.ts

/** State semantic spec (data-only contract). */
export type StateSpec =
  | BoolStateSpec
  | EnumStateSpec<readonly string[]>
  | StringStateSpec
  | NumberRangeStateSpec
  | NumberDiscreteStateSpec
  | NumberListStateSpec;

export type BoolStateSpec = { kind: 'bool' };

export type EnumStateSpec<O extends readonly string[]> = {
  kind: 'enum';
  options: O;
};

export type StringStateSpec = {
  kind: 'string';
  options?: readonly string[];
};

export type NumberRangeStateSpec = {
  kind: 'number.range';
  min: number;
  max: number;
  clamp?: boolean;
};

export type NumberDiscreteStateSpec = {
  kind: 'number.discrete';
  options?: readonly number[];
  min?: number;
  max?: number;
  step?: number;
};

/** Canonical immutable dense finite-number sequence. */
export type NumberListStateSpec = { kind: 'number.list' };

/** Reason is intentionally unknown (policy/shape is up to app/framework). */
export type StateSetReason = unknown;

export type DisconnectReason = 'unmount';

/** Event shape used by watch/subscribe. */
export type StateEvent<V> =
  | { type: 'next'; next: V; prev: V; reason?: StateSetReason }
  | { type: 'disconnect'; reason: DisconnectReason };

/** Value inference helper (mainly for enum literal union). */
export type StateValueOfSpec<S extends StateSpec> = S['kind'] extends 'bool'
  ? boolean
  : S['kind'] extends 'enum'
    ? S extends { options: readonly (infer T)[] }
      ? Extract<T, string>
      : string
    : S['kind'] extends 'string'
      ? string
      : S['kind'] extends 'number.range' | 'number.discrete'
        ? number
        : S['kind'] extends 'number.list'
          ? readonly number[]
          : never;

export type StateDefineSpec =
  | BoolStateDefineSpec
  | EnumStateDefineSpec<readonly string[]>
  | StringStateDefineSpec
  | NumberRangeStateDefineSpec
  | NumberDiscreteStateDefineSpec
  | NumberListStateDefineSpec;

// define spec 不带 kind（因为 kind 由 def.state.xxx 决定）
export type BoolStateDefineSpec = {}; // bool 无参数

export type EnumStateDefineSpec<O extends readonly string[]> = {
  options: O;
};

export type StringStateDefineSpec = {
  options?: readonly string[];
};

export type NumberRangeStateDefineSpec = {
  min: number;
  max: number;
  clamp?: boolean;
};

export type NumberDiscreteStateDefineSpec = {
  options?: readonly number[];
  min?: number;
  max?: number;
  step?: number;
};

export type NumberListStateDefineSpec = {};

// 给 module/kernel 用的 normalize 工具（types 层也可以只给类型，不给函数）
export type NormalizeStateSpec =
  | { kind: 'number.list' }
  | { kind: 'bool' }
  | { kind: 'enum'; options: readonly string[] }
  | { type: 'string'; options?: readonly string[] }
  | { kind: 'number.range'; min: number; max: number; clamp?: boolean }
  | {
      kind: 'number.discrete';
      options?: readonly number[];
      min?: number;
      max?: number;
      step?: number;
    };
