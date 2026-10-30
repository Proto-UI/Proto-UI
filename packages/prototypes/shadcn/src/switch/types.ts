import type { ShadcnStyleId, ShadcnStyleProps } from '../style-scope';
import type { ExposeMethod } from '@proto.ui/core';
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

export type ShadcnSwitchSize = 'default' | 'sm';

export interface ShadcnSwitchRootProps extends SwitchRootProps, ShadcnStyleProps {
  size?: ShadcnSwitchSize;
}

export type ShadcnSwitchRootExposes = SwitchRootExposes & {
  /** Family visual capability; consumed only through the actual Switch-domain Root. */
  getVisualSize: ExposeMethod<() => ShadcnSwitchSize>;
  getVisualStyle: ExposeMethod<() => ShadcnStyleId>;
};

export type ShadcnSwitchRootStateHandles = SwitchRootStateHandles;

export type ShadcnSwitchRootAsHookContract = SwitchRootAsHookContract;

export interface ShadcnSwitchThumbProps extends SwitchThumbProps {}

export type ShadcnSwitchThumbExposes = SwitchThumbExposes;

export type ShadcnSwitchThumbStateHandles = SwitchThumbStateHandles;

export type ShadcnSwitchThumbAsHookContract = SwitchThumbAsHookContract;
