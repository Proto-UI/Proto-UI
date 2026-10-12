import type {
  SelectContentAsHookContract,
  SelectContentExposes,
  SelectContentProps,
  SelectItemAsHookContract,
  SelectItemExposes,
  SelectItemProps,
  SelectRootAsHookContract,
  SelectRootExposes,
  SelectRootProps,
  SelectTriggerAsHookContract,
  SelectTriggerExposes,
  SelectTriggerProps,
  SelectValueAsHookContract,
  SelectValueExposes,
  SelectValueProps,
} from '@proto.ui/prototypes-base/select';

export type ShadcnSelectRootProps = SelectRootProps;
export type ShadcnSelectRootExposes = SelectRootExposes;
export type ShadcnSelectRootAsHookContract = SelectRootAsHookContract;

export interface ShadcnSelectTriggerProps extends SelectTriggerProps {
  size?: 'sm' | 'default';
  /** Additive presentation; omitted values retain the existing field surface. */
  appearance?: 'default' | 'ghost';
}
export type ShadcnSelectTriggerExposes = SelectTriggerExposes;
export type ShadcnSelectTriggerAsHookContract = SelectTriggerAsHookContract;

export type ShadcnSelectValueProps = SelectValueProps;
export type ShadcnSelectValueExposes = SelectValueExposes;
export type ShadcnSelectValueAsHookContract = SelectValueAsHookContract;

export interface ShadcnSelectContentProps extends SelectContentProps {
  position?: 'item-aligned' | 'popper';
}
export type ShadcnSelectContentExposes = SelectContentExposes;
export type ShadcnSelectContentAsHookContract = SelectContentAsHookContract;

export type ShadcnSelectItemProps = SelectItemProps;
export type ShadcnSelectItemExposes = SelectItemExposes;
export type ShadcnSelectItemAsHookContract = SelectItemAsHookContract;

export type {
  SelectGroupProps as ShadcnSelectGroupProps,
  SelectGroupExposes as ShadcnSelectGroupExposes,
  SelectGroupAsHookContract as ShadcnSelectGroupAsHookContract,
} from '@proto.ui/prototypes-base/select';

export type {
  SelectLabelProps as ShadcnSelectLabelProps,
  SelectLabelExposes as ShadcnSelectLabelExposes,
  SelectLabelAsHookContract as ShadcnSelectLabelAsHookContract,
} from '@proto.ui/prototypes-base/select';

export type {
  SelectSeparatorProps as ShadcnSelectSeparatorProps,
  SelectSeparatorExposes as ShadcnSelectSeparatorExposes,
  SelectSeparatorAsHookContract as ShadcnSelectSeparatorAsHookContract,
} from '@proto.ui/prototypes-base/select';
