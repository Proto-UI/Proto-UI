import { cap, type OwnedDecorationTarget } from '@proto.ui/core';
/** Draft fixed-first-view capability, opt-in only on a physically closed adapter. */
export const OWNED_DECORATION_CAP = cap<true>('@proto.ui/feedback/owned-decoration-fixed-view');
export type OwnedDecorationBinding = {
  target: OwnedDecorationTarget;
  sink(value: Readonly<{ kind: 'tw'; tokens: readonly string[] }>): void;
};
