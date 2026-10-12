import type {
  DropdownContentAsHookContract,
  DropdownContentExposes,
  DropdownContentProps,
  DropdownItemAsHookContract,
  DropdownItemExposes,
  DropdownItemProps,
  DropdownLabelProps,
  DropdownRootAsHookContract,
  DropdownRootExposes,
  DropdownRootProps,
  DropdownTriggerAsHookContract,
  DropdownTriggerExposes,
  DropdownTriggerProps,
} from '@proto.ui/prototypes-base/dropdown';

export type ShadcnDropdownTriggerIndicatorIcon = 'chevron-down' | 'chevrons-up-down';

export type ShadcnDropdownRootProps = DropdownRootProps;
export type ShadcnDropdownRootExposes = DropdownRootExposes;
export type ShadcnDropdownRootAsHookContract = DropdownRootAsHookContract;

export interface ShadcnDropdownTriggerProps extends DropdownTriggerProps {
  indicator?: boolean;
  indicatorIcon?: ShadcnDropdownTriggerIndicatorIcon;
  indicatorSize?: number;
  indicatorStrokeWidth?: number;
}
export type ShadcnDropdownTriggerExposes = DropdownTriggerExposes;
export type ShadcnDropdownTriggerAsHookContract = DropdownTriggerAsHookContract;

export type ShadcnDropdownContentProps = DropdownContentProps;
export type ShadcnDropdownContentExposes = DropdownContentExposes;
export type ShadcnDropdownContentAsHookContract = DropdownContentAsHookContract;

export interface ShadcnDropdownItemProps extends DropdownItemProps {
  inset?: boolean;
  variant?: 'default' | 'destructive';
}
export type ShadcnDropdownItemExposes = DropdownItemExposes;
export type ShadcnDropdownItemAsHookContract = DropdownItemAsHookContract;

export interface ShadcnDropdownLabelProps extends DropdownLabelProps {
  inset?: boolean;
}
