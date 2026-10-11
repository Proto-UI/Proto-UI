import type { AnchoredPositionHandle, AvailableSpaceHandle, ModuleInstance } from '@proto.ui/core';

export type PositioningFacade = {
  declareContextMenuInput(): import('@proto.ui/core').ContextMenuInputHandle;
  getAnchoredPosition(): AnchoredPositionHandle;
  getAvailableSpace(): AvailableSpaceHandle;
};

export type PositioningPort = {
  setCallbackDispatcher(dispatch: (callback: () => void) => void): void;
  getAnchoredPosition(): AnchoredPositionHandle;
  getAvailableSpace(): AvailableSpaceHandle;
};

export type PositioningModule = ModuleInstance<PositioningFacade> & {
  name: 'positioning';
  scope: 'instance';
  port: PositioningPort;
};
