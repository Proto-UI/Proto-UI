import { cap, type OverlayLayerRole } from '@proto.ui/core';

/** Host-private physical targets, verified before Module side effects. */
export type OverlayTargetHost = {
  root(): object | null;
  resolve(candidate: unknown): object | null;
};
export const OVERLAY_TARGET_HOST_CAP = cap<OverlayTargetHost>('@proto.ui/overlay/targetHost');

export type OverlayGlobalMount<Target = unknown> = {
  mount(el: Target): void;
  unmount(el: Target): void;
};

export const OVERLAY_GLOBAL_MOUNT_CAP = cap<OverlayGlobalMount>('@proto.ui/overlay/globalMount');

export type OverlayModal = {
  lock(): void;
  unlock(): void;
};

export const OVERLAY_MODAL_CAP = cap<OverlayModal>('@proto.ui/overlay/modal');

export type OverlayLayerRequest = Readonly<{
  role: OverlayLayerRole;
  offset: number;
  modal: boolean;
  portal: boolean;
  meta?: Readonly<Record<string, unknown>>;
}>;

export type OverlayLayerScheduler<Target = unknown> = {
  attach(target: Target, request: OverlayLayerRequest): () => void;
};

export const OVERLAY_LAYER_SCHEDULER_CAP = cap<OverlayLayerScheduler>(
  '@proto.ui/overlay/layerScheduler'
);
