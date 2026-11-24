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

export type BrutalistSwitchSize = 'default' | 'sm';

export interface BrutalistSwitchRootProps extends SwitchRootProps {
  /** Temporarily unsupported until input and direct presentation share the pinned travel endpoints. */
  draggable?: false;
  size?: BrutalistSwitchSize;
}
export type BrutalistSwitchRootExposes = SwitchRootExposes & {
  /** Family visual capability; consumed only through the actual Switch-domain Root. */
  getVisualSize: ExposeMethod<() => BrutalistSwitchSize>;
};
export type BrutalistSwitchRootStateHandles = SwitchRootStateHandles;
export type BrutalistSwitchRootAsHookContract = SwitchRootAsHookContract;

export interface BrutalistSwitchThumbProps extends SwitchThumbProps {}
export type BrutalistSwitchThumbExposes = SwitchThumbExposes;
export type BrutalistSwitchThumbStateHandles = SwitchThumbStateHandles;
export type BrutalistSwitchThumbAsHookContract = SwitchThumbAsHookContract;
