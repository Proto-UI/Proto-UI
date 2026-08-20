import type { ModuleInstance } from '@proto.ui/core';
import type { ExposeEventSpec } from '@proto.ui/types';

export type ExposeEventFacade = {
  /** Setup-only declaration validation against the shared Expose registry. */
  registerExposeEvent(key: string, spec?: ExposeEventSpec): void;

  /** Runtime-only outward signal emission. */
  emit(key: string, payload?: any, options?: Record<string, unknown>): void;
};

export type ExposeEventModule = ModuleInstance<ExposeEventFacade> & {
  name: 'expose-event';
  scope: 'instance';
};
