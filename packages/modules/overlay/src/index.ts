export { OverlayModuleDef } from './create';
export {
  OVERLAY_GLOBAL_MOUNT_CAP,
  OVERLAY_MODAL_CAP,
  OVERLAY_LAYER_SCHEDULER_CAP,
  OVERLAY_TARGET_HOST_CAP,
} from './caps';
export type { OverlayFacade, OverlayModule, OverlayPort } from './types';
export type {
  OverlayGlobalMount,
  OverlayModal,
  OverlayLayerRequest,
  OverlayLayerScheduler,
  OverlayTargetHost,
} from './caps';
export {
  createZIndexOverlayLayerScheduler,
  type OverlayZIndexLayerSchedulerOptions,
} from './web/z-index-layer-scheduler';

export { createWebOverlayModal } from './web/modal-lock';
