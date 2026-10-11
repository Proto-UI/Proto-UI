import { cap } from '@proto.ui/core';
import type { HitParticipationConfig, HitParticipationRegion } from '@proto.ui/core';

export type HitParticipationHostBridge = {
  /** Explicit profile support; older bridges must not silently ignore static geometry. */
  readonly supportsStaticHitInset?: true;
  sync(args: { config: HitParticipationConfig; regions: readonly HitParticipationRegion[] }): void;
};

export const HIT_PARTICIPATION_HOST_BRIDGE_CAP = cap<HitParticipationHostBridge>(
  '@proto.ui/hitParticipation/hostBridge'
);
