import type {
  HideableConfig,
  HideableHandle,
  ModuleInstance,
  VisibilityFacts,
} from '@proto.ui/core';
import type { PropsBaseType } from '@proto.ui/types';

export type VisibilityFacade = {
  getHideable<P extends PropsBaseType = PropsBaseType>(): HideableHandle<P>;
};

export type VisibilityPort = {
  getFacts(): VisibilityFacts;
  getConfig(): HideableConfig;
};

export type VisibilityHostBridge = {
  project(facts: VisibilityFacts): void;
};

export type VisibilityModule = ModuleInstance<VisibilityFacade> & {
  name: 'visibility';
  scope: 'instance';
  port: VisibilityPort;
};
