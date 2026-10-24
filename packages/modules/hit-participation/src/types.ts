import type {
  HitParticipationConfig,
  HitParticipationConfigPatch,
  HitParticipationHandle,
  HitParticipationRegion,
  HitParticipationRegionOptions,
  ModuleInstance,
  ModulePort,
} from '@proto.ui/core';
import type { PropsBaseType } from '@proto.ui/types';

export type { HitParticipationHostBridge } from './caps';

export type HitParticipationFacade = {
  getHitParticipation<P extends PropsBaseType = PropsBaseType>(): HitParticipationHandle<P>;
};

export type HitParticipationPort = ModulePort & {
  configure(patch: HitParticipationConfigPatch): void;
  registerSelfRegion(options?: HitParticipationRegionOptions): () => void;
  registerRegion(target: unknown, options?: HitParticipationRegionOptions): () => void;
  unregisterRegion(target: unknown): void;
  getConfig(): HitParticipationConfig;
  getWarnings(): readonly string[];
  getRegions(): readonly HitParticipationRegion[];
};

export type HitParticipationModule = ModuleInstance<HitParticipationFacade> & {
  name: 'hit-participation';
  scope: 'instance';
  port: HitParticipationPort;
};
