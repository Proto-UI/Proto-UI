export { PositioningModuleDef } from './create';
export { ANCHORED_POSITION_HOST_CAP } from './caps';
export type { AnchoredPositionHost, AnchoredPositionHostLease } from './caps';
export type { PositioningFacade, PositioningModule, PositioningPort } from './types';
export { createFloatingUiAnchoredPositionHost } from './web/floating-ui-host';

export { AVAILABLE_SPACE_HOST_CAP } from './caps';
export type {
  AvailableSpaceHost,
  AvailableSpaceHostLease,
  AvailableSpaceHostConnection,
} from './caps';
export { createWebAvailableSpaceHost } from './web/available-space-host';
