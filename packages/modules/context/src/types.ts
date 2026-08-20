// packages/modules/context/src/types.ts
import type { ModuleInstance, Unsubscribe } from '@proto.ui/core';
import type { ContextKey, JsonObject } from '@proto.ui/types';
import type { ContextInstanceToken } from './caps';

export type ContextCallbackCtx = unknown;
export type ContextCallbackDispatcher = (fn: (ctx: unknown) => void) => void;

export type ContextChangeCb<T extends JsonObject> = (
  ctx: ContextCallbackCtx,
  next: T,
  prev: T
) => void;

export type ContextChangeCbOptional<T extends JsonObject> = (
  ctx: ContextCallbackCtx,
  next: T | null,
  prev: T | null
) => void;

export type ContextFacade = {
  // setup-only
  provide<T extends JsonObject>(key: ContextKey<T>, defaultValue: T): void;

  subscribe<T extends JsonObject>(key: ContextKey<T>, onChange?: ContextChangeCb<T>): Unsubscribe;

  trySubscribe<T extends JsonObject>(
    key: ContextKey<T>,
    onChange?: ContextChangeCbOptional<T>
  ): Unsubscribe;

  // runtime-only
  read<T extends JsonObject>(key: ContextKey<T>): T;
  tryRead<T extends JsonObject>(key: ContextKey<T>): T | null;

  update<T extends JsonObject>(key: ContextKey<T>, next: T | ((prev: T) => T)): void;

  tryUpdate<T extends JsonObject>(key: ContextKey<T>, next: T | ((prev: T) => T)): boolean;
};

export type ContextProviderEntry = {
  instance: ContextInstanceToken;
  key: ContextKey<any>;
  value: JsonObject;
};

export type ContextSubscriptionEntry = {
  instance: ContextInstanceToken;
  key: ContextKey<any>;
  mode: 'required' | 'optional';
  callbackCount: number;
};

export type ContextCallbackTask = {
  instance: ContextInstanceToken;
  key: ContextKey<any>;
  next: JsonObject | null;
  prev: JsonObject | null;
  callbackCount: number;
};

export type ContextPort = {
  setCallbackDispatcher(dispatch: ContextCallbackDispatcher): void;
  /** Module-internal logical scope identity. Never place this token in a Context value. */
  resolveScope(key: ContextKey<any>, consumer?: ContextInstanceToken): ContextInstanceToken | null;
  dumpProviders(): readonly ContextProviderEntry[];
  dumpSubscriptions(): readonly ContextSubscriptionEntry[];
  dumpCallbackQueue(): readonly ContextCallbackTask[];
};

export type ContextModule = ModuleInstance<ContextFacade> & {
  name: 'context';
  scope: 'singleton';
};
