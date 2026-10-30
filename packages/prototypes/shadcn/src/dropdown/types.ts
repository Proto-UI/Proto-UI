import type {
  DropdownContentAsHookContract,
  DropdownContentExposes,
  DropdownContentProps,
  DropdownGroupProps,
  DropdownItemAsHookContract,
  DropdownItemExposes,
  DropdownItemProps,
  DropdownLabelProps,
  DropdownRootAsHookContract,
  DropdownRootExposes,
  DropdownRootProps,
  DropdownSeparatorProps,
  DropdownShortcutProps,
  DropdownTriggerAsHookContract,
  DropdownTriggerExposes,
  DropdownTriggerProps,
} from '@proto.ui/prototypes-base/dropdown';
import type { ShadcnStyleProps } from '../style-scope';

export type ShadcnDropdownTriggerIndicatorIcon = 'chevron-down' | 'chevrons-up-down';

export type ShadcnDropdownRootProps = DropdownRootProps & ShadcnStyleProps;
export type ShadcnDropdownRootExposes = DropdownRootExposes;
export type ShadcnDropdownRootAsHookContract = DropdownRootAsHookContract;

export interface ShadcnDropdownTriggerProps extends DropdownTriggerProps, ShadcnStyleProps {
  indicator?: boolean;
  indicatorIcon?: ShadcnDropdownTriggerIndicatorIcon;
  indicatorSize?: number;
  indicatorStrokeWidth?: number;
}
export type ShadcnDropdownTriggerExposes = DropdownTriggerExposes;
export type ShadcnDropdownTriggerAsHookContract = DropdownTriggerAsHookContract;

export type ShadcnDropdownContentProps = DropdownContentProps & ShadcnStyleProps;
export type ShadcnDropdownContentExposes = DropdownContentExposes;
export type ShadcnDropdownContentAsHookContract = DropdownContentAsHookContract;

export interface ShadcnDropdownItemProps extends DropdownItemProps, ShadcnStyleProps {
  inset?: boolean;
  variant?: 'default' | 'destructive';
}
export type ShadcnDropdownItemExposes = DropdownItemExposes;
export type ShadcnDropdownItemAsHookContract = DropdownItemAsHookContract;

export interface ShadcnDropdownLabelProps extends DropdownLabelProps, ShadcnStyleProps {
  inset?: boolean;
}
export type ShadcnDropdownGroupProps = DropdownGroupProps & ShadcnStyleProps;
export type ShadcnDropdownSeparatorProps = DropdownSeparatorProps & ShadcnStyleProps;
export type ShadcnDropdownShortcutProps = DropdownShortcutProps & ShadcnStyleProps;
