import type { AnchoredPositionHandle, AvailableSpaceHandle, ModuleInstance } from '@proto.ui/core';

export type PositioningFacade = {
  getAnchoredPosition(): AnchoredPositionHandle;
  getAvailableSpace(): AvailableSpaceHandle;
};

export type PositioningPort = {
  getAnchoredPosition(): AnchoredPositionHandle;
  getAvailableSpace(): AvailableSpaceHandle;
};

export type PositioningModule = ModuleInstance<PositioningFacade> & {
  name: 'positioning';
  scope: 'instance';
  port: PositioningPort;
};
