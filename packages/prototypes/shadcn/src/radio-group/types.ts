import type {
  RadioGroupIndicatorAsHookContract,
  RadioGroupIndicatorExposes,
  RadioGroupIndicatorProps,
  RadioGroupIndicatorStateHandles,
  RadioGroupItemAsHookContract,
  RadioGroupItemExposes,
  RadioGroupItemProps,
  RadioGroupItemStateHandles,
  RadioGroupRootAsHookContract,
  RadioGroupRootExposes,
  RadioGroupRootProps,
  RadioGroupRootStateHandles,
} from '@proto.ui/prototypes-base/radio-group';
import type { ShadcnStyleProps } from '../style-scope';

export interface ShadcnRadioGroupRootProps extends RadioGroupRootProps, ShadcnStyleProps {}
export type ShadcnRadioGroupRootExposes = RadioGroupRootExposes;
export type ShadcnRadioGroupRootStateHandles = RadioGroupRootStateHandles;
export type ShadcnRadioGroupRootAsHookContract = RadioGroupRootAsHookContract;

export interface ShadcnRadioGroupItemProps extends RadioGroupItemProps, ShadcnStyleProps {}
export type ShadcnRadioGroupItemExposes = RadioGroupItemExposes;
export type ShadcnRadioGroupItemStateHandles = RadioGroupItemStateHandles;
export type ShadcnRadioGroupItemAsHookContract = RadioGroupItemAsHookContract;

export interface ShadcnRadioGroupIndicatorProps extends RadioGroupIndicatorProps {}
export type ShadcnRadioGroupIndicatorExposes = RadioGroupIndicatorExposes;
export type ShadcnRadioGroupIndicatorStateHandles = RadioGroupIndicatorStateHandles;
export type ShadcnRadioGroupIndicatorAsHookContract = RadioGroupIndicatorAsHookContract;
