import switchRoot from './root.proto';
import switchThumb from './thumb.proto';

export type {
  ShadcnSwitchSize,
  ShadcnSwitchRootProps,
  ShadcnSwitchRootExposes,
  ShadcnSwitchRootStateHandles,
  ShadcnSwitchRootAsHookContract,
  ShadcnSwitchThumbProps,
  ShadcnSwitchThumbExposes,
  ShadcnSwitchThumbAsHookContract,
} from './types';

export { switchRoot, switchThumb };
export { default as shadcnSwitchRoot } from './root.proto';
export { default as shadcnSwitchThumb } from './thumb.proto';
export { default as componentPreset, shadcnSwitchComponentPreset } from './preset';
