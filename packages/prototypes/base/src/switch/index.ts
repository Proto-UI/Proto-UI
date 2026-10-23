export type {
  SwitchRootProps,
  SwitchRootExposes,
  SwitchRootStateHandles,
  SwitchRootAsHookContract,
  SwitchThumbProps,
  SwitchThumbExposes,
  SwitchThumbStateHandles,
  SwitchThumbAsHookContract,
} from './types';

export { SWITCH_FAMILY } from './shared';
export {
  asSwitchRoot,
  setupSwitchRoot,
  type SwitchRootSetupOptions,
  default as switchRoot,
} from './root.proto';
export { asSwitchThumb, default as switchThumb } from './thumb.proto';
