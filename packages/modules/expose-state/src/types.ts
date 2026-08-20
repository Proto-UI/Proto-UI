// packages/modules/expose-state/src/types.ts
import type { ModuleInstance, ModulePort, Unsubscribe } from '@proto.ui/core';
import { isExposeEventDeclaration } from '@proto.ui/module-expose';
import type { StateEvent, StateSpec } from '@proto.ui/types';

export const EXPOSE_STATE_EXTERNAL_HANDLE = Symbol.for('@proto.ui/expose-state/external-handle');

export type ExposeStateExternalHandle<V = any> = {
  readonly [EXPOSE_STATE_EXTERNAL_HANDLE]: true;
  get(): V;
  subscribe(cb: (e: StateEvent<V>) => void): Unsubscribe;
  unsubscribe(off: Unsubscribe): void;
  readonly spec: StateSpec;
};

export function isExposeStateExternalHandle(
  value: unknown
): value is ExposeStateExternalHandle<unknown> {
  return (
    !!value &&
    typeof value === 'object' &&
    (value as ExposeStateExternalHandle<unknown>)[EXPOSE_STATE_EXTERNAL_HANDLE] === true
  );
}

/** Returns whether a classified translation-record value belongs in an App Maker record. */
export function isAppMakerExposeRecordEntry(value: unknown): boolean {
  return !isExposeEventDeclaration(value);
}

export type ExposeStateFacade = {};

export type ExposeStateDiag = {
  key: string;
  kind: 'state' | 'value';
  valueType: string;
};

export type ExposeStatePort = ModulePort & {
  get(key: string): unknown | undefined;
  getAll(): Record<string, unknown>;
  getDiagnostics?(): readonly ExposeStateDiag[];
};

export type ExposeStateModule = ModuleInstance<ExposeStateFacade> & {
  name: 'expose-state';
  scope: 'instance';
};
