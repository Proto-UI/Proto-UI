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

export type LiquidGlassRadioGroupRootProps = RadioGroupRootProps;
export type LiquidGlassRadioGroupRootExposes = RadioGroupRootExposes;
export type LiquidGlassRadioGroupRootStateHandles = RadioGroupRootStateHandles;
export type LiquidGlassRadioGroupRootAsHookContract = RadioGroupRootAsHookContract;

// The Item is the one governable functional owner in this family; Root is a
// structural collection container and Indicator is a passive context part.
export type LiquidGlassRadioGroupItemProps = RadioGroupItemProps & {
  material?: 'auto' | 'opaque';
};
export type LiquidGlassRadioGroupItemExposes = RadioGroupItemExposes;
export type LiquidGlassRadioGroupItemStateHandles = RadioGroupItemStateHandles;
export type LiquidGlassRadioGroupItemAsHookContract = RadioGroupItemAsHookContract;

export type LiquidGlassRadioGroupIndicatorProps = RadioGroupIndicatorProps;
export type LiquidGlassRadioGroupIndicatorExposes = RadioGroupIndicatorExposes;
export type LiquidGlassRadioGroupIndicatorStateHandles = RadioGroupIndicatorStateHandles;
export type LiquidGlassRadioGroupIndicatorAsHookContract = RadioGroupIndicatorAsHookContract;
