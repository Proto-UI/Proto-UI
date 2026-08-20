import type {
  AnatomyClaimDecl,
  AnatomyFamily,
  AnatomyQueryOrderView,
  AnatomyPartView,
  ModuleInstance,
  ModulePort,
  Unsubscribe,
} from '@proto.ui/core';

export type AnatomyDiagnostic = {
  level: 'warning' | 'error';
  scope: 'family' | 'profile';
  code: string;
  message: string;
  family: AnatomyFamily;
  role?: string;
  profile?: string;
};

export type AnatomyOrderCallbackCtx = unknown;
export type AnatomyOrderCallbackDispatcher = (fn: (ctx: AnatomyOrderCallbackCtx) => void) => void;
export type AnatomyOrderChangeCb = (ctx: AnatomyOrderCallbackCtx) => void;

export type AnatomyFacade = {
  claim(family: AnatomyFamily, decl: AnatomyClaimDecl): void;
  subscribeParts(
    family: AnatomyFamily,
    role: string,
    cb: (ctx: AnatomyOrderCallbackCtx, parts: readonly AnatomyPartView[]) => void
  ): Unsubscribe;

  has(family: AnatomyFamily, role: string): boolean;
  parts: AnatomyQueryOrderView['parts'];
  partsOf: AnatomyQueryOrderView['partsOf'];
  order: AnatomyQueryOrderView;
};

export type AnatomyPort = ModulePort & {
  getDiagnostics(): readonly AnatomyDiagnostic[];
  /** Module-internal bridge. Never expose the returned host target to prototype authors. */
  resolvePartTarget(part: AnatomyPartView): unknown | null;
  /** Opaque root-claim identity for bounded module-internal family coordination. */
  resolveDomainScope(family: AnatomyFamily): unknown | null;
  /** Module-internal structural query scoped to one already resolved family domain. */
  descendantsOf(
    family: AnatomyFamily,
    ancestor: AnatomyPartView,
    role: string
  ): readonly AnatomyPartView[];
  parts: AnatomyQueryOrderView['parts'];
  order: AnatomyQueryOrderView;
  setOrderCallbackDispatcher(dispatch: AnatomyOrderCallbackDispatcher): void;
  subscribeOrder(family: AnatomyFamily, cb: AnatomyOrderChangeCb): Unsubscribe;
  /** Module-internal target readiness/replacement signal; carries no target or data payload. */
  subscribeTargets(family: AnatomyFamily, cb: AnatomyOrderChangeCb): Unsubscribe;
};

export type AnatomyModule = ModuleInstance<AnatomyFacade> & {
  name: 'anatomy';
  scope: 'instance';
  port?: AnatomyPort;
};
