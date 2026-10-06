import { cap, type AnchoredPositionConnection } from '@proto.ui/core';

export interface AnchoredPositionHostLease {
  update(connection: AnchoredPositionConnection): void;
  requestUpdate(): void;
  dispose(): void;
}

export interface AnchoredPositionHost {
  attach(connection: AnchoredPositionConnection): AnchoredPositionHostLease;
}

export const ANCHORED_POSITION_HOST_CAP = cap<AnchoredPositionHost>(
  '@proto.ui/positioning/anchoredHost'
);

export type AvailableSpaceHostConnection = import('@proto.ui/core').AvailableSpaceConnection & {
  readonly viewEpoch: number;
};
export interface AvailableSpaceHostLease {
  /** Host diagnostics, never a Proto state surface. null means no active/known frame. */
  getFrame?(): import('@proto.ui/core').AvailableSpaceFrame | null;
  requestUpdate(): void;
  dispose(): void;
}
export interface AvailableSpaceHost {
  attach(connection: AvailableSpaceHostConnection): AvailableSpaceHostLease;
}
export const AVAILABLE_SPACE_HOST_CAP = cap<AvailableSpaceHost>(
  '@proto.ui/positioning/availableSpaceHost'
);
