// packages/modules/expose/src/types.ts
import type { ModuleInstance, ModulePort } from '@proto.ui/core';

export const EXPOSE_ENTRY_CLASSIFICATION = Symbol.for('@proto.ui/expose/entry-classification');

export type ExposeEventDeclaration = Readonly<{
  readonly [EXPOSE_ENTRY_CLASSIFICATION]: 'event';
  readonly __pui_expose: 'event';
  readonly spec?: unknown;
}>;

export function createExposeEventDeclaration(spec?: unknown): ExposeEventDeclaration {
  return Object.freeze({
    [EXPOSE_ENTRY_CLASSIFICATION]: 'event' as const,
    __pui_expose: 'event' as const,
    spec,
  });
}

export function isExposeEventDeclaration(value: unknown): value is ExposeEventDeclaration {
  return (
    !!value &&
    typeof value === 'object' &&
    (value as ExposeEventDeclaration)[EXPOSE_ENTRY_CLASSIFICATION] === 'event'
  );
}

export type ExposeFacade = {
  expose(key: string, value: unknown): void;
};

export type ExposeDiag = {
  key: string;
  valueType: string;
  isFunction: boolean;
  isObject: boolean;
};

export type ExposePort = ModulePort & {
  get(key: string): unknown | undefined;
  getAll(): Record<string, unknown>;
  has(key: string): boolean;
  keys(): readonly string[];
  getDiagnostics?(): readonly ExposeDiag[];
};

export type ExposeModule = ModuleInstance<ExposeFacade> & {
  name: 'expose';
  scope: 'instance';
};
