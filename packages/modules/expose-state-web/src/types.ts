// packages/modules/expose-state-web/src/types.ts
import type { ModuleInstance, ModulePort } from '@proto.ui/core';
import type { StateSpec } from '@proto.ui/types';
import type { ExposeStateExternalHandle } from '@proto.ui/module-expose-state';

export type ExposeStateWebFacade = {};

export type ExposeStateWebBinding = {
  stateId: string;
  key: string;
  semantic?: string;
  kind: StateSpec['kind'];
  attr?: string;
  cssVar?: string;
};

export type ExposeStateWebPort = ModulePort & {
  isActive(): boolean;
  getExposedStateMap(): ReadonlyMap<string, ExposeStateWebBinding>;
  /**
   * Optional internal projection witness. Candidate name metadata alone does
   * not certify an emitted value or target. Older providers fail closed when
   * a consumer requires this current source/target/last-write relationship.
   */
  isCurrentCssVarProjection?(
    source: ExposeStateExternalHandle<unknown>,
    target: HTMLElement,
    name: string
  ): boolean;
};

export type ExposeStateWebModule = ModuleInstance<ExposeStateWebFacade> & {
  name: 'expose-state-web';
  scope: 'instance';
};
