import { cap, type AxisInputHost } from '@proto.ui/core';
export const AXIS_INPUT_HOST_CAP = cap<AxisInputHost>('@proto.ui/axis-input/host');
export const AXIS_INPUT_RUN_IN_CALLBACK_CAP = cap<(callback: () => void) => void>(
  '@proto.ui/axis-input/run-in-callback'
);
