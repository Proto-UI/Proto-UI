import type {
  SwitchRootAsHookContract,
  SwitchRootExposes,
  SwitchRootProps,
  SwitchRootStateHandles,
  SwitchThumbAsHookContract,
  SwitchThumbExposes,
  SwitchThumbProps,
  SwitchThumbStateHandles,
} from '@proto.ui/prototypes-base/switch';

// The standalone Switch and the Field-composed Switch share this paint setup;
// `material` is a Proto design-language extension in both projections.
export type LiquidGlassSwitchRootProps = SwitchRootProps & {
  material?: 'auto' | 'opaque';
};
export type LiquidGlassSwitchRootExposes = SwitchRootExposes;
export type LiquidGlassSwitchRootStateHandles = SwitchRootStateHandles;
export type LiquidGlassSwitchRootAsHookContract = SwitchRootAsHookContract;

export type LiquidGlassSwitchThumbProps = SwitchThumbProps;
export type LiquidGlassSwitchThumbExposes = SwitchThumbExposes;
export type LiquidGlassSwitchThumbStateHandles = SwitchThumbStateHandles;
export type LiquidGlassSwitchThumbAsHookContract = SwitchThumbAsHookContract;
