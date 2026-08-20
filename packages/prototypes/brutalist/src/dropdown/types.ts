import type {
  DropdownContentAsHookContract,
  DropdownContentExposes,
  DropdownContentProps,
  DropdownItemAsHookContract,
  DropdownItemExposes,
  DropdownItemProps,
  DropdownRootAsHookContract,
  DropdownRootExposes,
  DropdownRootProps,
  DropdownTriggerAsHookContract,
  DropdownTriggerExposes,
  DropdownTriggerProps,
} from '@proto.ui/prototypes-base/dropdown';

export type BrutalistDropdownTriggerIndicatorIcon = 'chevron-down' | 'chevrons-up-down';

export type BrutalistDropdownRootProps = DropdownRootProps;
export type BrutalistDropdownRootExposes = DropdownRootExposes;
export type BrutalistDropdownRootAsHookContract = DropdownRootAsHookContract;

export interface BrutalistDropdownTriggerProps extends DropdownTriggerProps {
  indicator?: boolean;
  indicatorIcon?: BrutalistDropdownTriggerIndicatorIcon;
  indicatorSize?: number;
  indicatorStrokeWidth?: number;
}
export type BrutalistDropdownTriggerExposes = DropdownTriggerExposes;
export type BrutalistDropdownTriggerAsHookContract = DropdownTriggerAsHookContract;

export type BrutalistDropdownContentProps = DropdownContentProps;
export type BrutalistDropdownContentExposes = DropdownContentExposes;
export type BrutalistDropdownContentAsHookContract = DropdownContentAsHookContract;

export interface BrutalistDropdownItemProps extends DropdownItemProps {
  inset?: boolean;
  variant?: 'default' | 'destructive';
}
export type BrutalistDropdownItemExposes = DropdownItemExposes;
export type BrutalistDropdownItemAsHookContract = DropdownItemAsHookContract;
