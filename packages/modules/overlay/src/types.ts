import type {
  ModuleInstance,
  OverlayConfig,
  OverlayConfigPatch,
  OverlayModuleHandle,
  OverlayPositionPatch,
  OverlayReason,
  OverlayRegistration,
} from '@proto.ui/core';
import type { PropsBaseType } from '@proto.ui/types';

export type {
  OverlayGlobalMount,
  OverlayModal,
  OverlayLayerRequest,
  OverlayLayerScheduler,
} from './caps';

export type OverlayFacade = {
  getOverlay<P extends PropsBaseType = PropsBaseType>(): OverlayModuleHandle<P>;
};

export type OverlayPort = {
  /** Synchronous invocation in the Runtime callback scope; never async scheduling. */
  setCallbackDispatcher(dispatch: (callback: () => void) => void): void;
  configure(patch: OverlayConfigPatch): void;
  open(reason?: OverlayReason): void;
  close(reason?: OverlayReason): void;
  toggle(reason?: OverlayReason): void;
  isOpen(): boolean;
  getConfig(): OverlayConfig;
  getWarnings(): readonly string[];
  getLastReason(): OverlayReason | undefined;
  getRegistration(): OverlayRegistration;
  getPositionSnapshot(): import('@proto.ui/core').AnchoredPositionSnapshot | null;
  registerTrigger(target: unknown): void;
  registerAnchor(target: unknown): void;
  registerAnchorPart(part: import('@proto.ui/core').AnatomyPartView): void;
  registerContent(target: unknown): void;
  registerTargetAlignment(
    binding: import('@proto.ui/core').OverlayTargetAlignmentBinding | null
  ): void;
  updatePosition(patch: OverlayPositionPatch): void;
  setViewActive(active: boolean): void;
  markPresenceBound(): void;
  hasPresenceBinding(): boolean;
  reconcileViewResourcesAfterCallback(): void;
};

export type OverlayModule = ModuleInstance<OverlayFacade> & {
  name: 'overlay';
  scope: 'instance';
  port: OverlayPort;
};
