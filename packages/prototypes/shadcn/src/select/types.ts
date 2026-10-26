import type { ShadcnStyleProps } from '../style-scope';
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

export type ShadcnSelectRootProps = SelectRootProps & ShadcnStyleProps;
export type ShadcnSelectRootExposes = SelectRootExposes;
export type ShadcnSelectRootAsHookContract = SelectRootAsHookContract;

export interface ShadcnSelectTriggerProps extends SelectTriggerProps, ShadcnStyleProps {
  size?: 'sm' | 'default';
  /** Additive presentation; omitted values retain the existing field surface. */
  appearance?: 'default' | 'ghost';
}
export type ShadcnSelectTriggerExposes = SelectTriggerExposes;
export type ShadcnSelectTriggerAsHookContract = SelectTriggerAsHookContract;

export type ShadcnSelectValueProps = SelectValueProps & ShadcnStyleProps;
export type ShadcnSelectValueExposes = SelectValueExposes;
export type ShadcnSelectValueAsHookContract = SelectValueAsHookContract;

export interface ShadcnSelectContentProps extends SelectContentProps, ShadcnStyleProps {
  position?: 'item-aligned' | 'popper';
}
export type ShadcnSelectContentExposes = SelectContentExposes;
export type ShadcnSelectContentAsHookContract = SelectContentAsHookContract;

export type ShadcnSelectItemProps = SelectItemProps & ShadcnStyleProps;
export type ShadcnSelectItemExposes = SelectItemExposes;
export type ShadcnSelectItemAsHookContract = SelectItemAsHookContract;

export type {
  SelectGroupExposes as ShadcnSelectGroupExposes,
  SelectGroupAsHookContract as ShadcnSelectGroupAsHookContract,
} from '@proto.ui/prototypes-base/select';

export type {
  SelectLabelExposes as ShadcnSelectLabelExposes,
  SelectLabelAsHookContract as ShadcnSelectLabelAsHookContract,
} from '@proto.ui/prototypes-base/select';

export type {
  SelectSeparatorExposes as ShadcnSelectSeparatorExposes,
  SelectSeparatorAsHookContract as ShadcnSelectSeparatorAsHookContract,
} from '@proto.ui/prototypes-base/select';

export type ShadcnSelectGroupProps = import('@proto.ui/prototypes-base/select').SelectGroupProps &
  ShadcnStyleProps;

export type ShadcnSelectLabelProps = import('@proto.ui/prototypes-base/select').SelectLabelProps &
  ShadcnStyleProps;

export type ShadcnSelectSeparatorProps =
  import('@proto.ui/prototypes-base/select').SelectSeparatorProps & ShadcnStyleProps;

/** Existing structural parts accept the same public family selection. */
export type ShadcnSelectSurfaceProps = ShadcnStyleProps;
export type ShadcnSelectViewportProps = ShadcnStyleProps;
export type ShadcnSelectItemTextProps = ShadcnStyleProps;
