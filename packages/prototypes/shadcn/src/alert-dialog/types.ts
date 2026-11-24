import type {
  AlertDialogActionProps as BaseActionProps,
  AlertDialogCancelProps as BaseCancelProps,
  AlertDialogRootProps as BaseRootProps,
  AlertDialogTriggerProps as BaseTriggerProps,
  AlertDialogContentProps as BaseContentProps,
  AlertDialogMaskProps as BaseMaskProps,
  AlertDialogTitleProps as BaseTitleProps,
  AlertDialogDescriptionProps as BaseDescriptionProps,
} from '@proto.ui/prototypes-base/alert-dialog';
import type { ShadcnStyleProps } from '../style-scope';

export type ShadcnAlertDialogSize = 'default' | 'sm';
export type ShadcnAlertDialogHeaderAlign = 'start' | 'center';
export type ShadcnAlertDialogActionVariant =
  | 'default'
  | 'destructive'
  | 'outline'
  | 'secondary'
  | 'ghost'
  | 'link';
export type ShadcnAlertDialogActionSize = 'default' | 'sm' | 'lg' | 'icon';

export type AlertDialogRootProps = BaseRootProps & ShadcnStyleProps;
export interface AlertDialogTriggerProps extends BaseTriggerProps, ShadcnStyleProps {
  variant?: ShadcnAlertDialogActionVariant;
  size?: ShadcnAlertDialogActionSize;
  wrap?: boolean;
}
export type AlertDialogContentProps = BaseContentProps &
  ShadcnStyleProps & {
    size?: ShadcnAlertDialogSize;
  };
export type AlertDialogMaskProps = BaseMaskProps & ShadcnStyleProps;
export type AlertDialogTitleProps = BaseTitleProps & ShadcnStyleProps;
export type AlertDialogDescriptionProps = BaseDescriptionProps & ShadcnStyleProps;

// Passive presentation parts add no interaction or configuration owner.
export interface ShadcnAlertDialogHeaderProps extends ShadcnStyleProps {
  align?: ShadcnAlertDialogHeaderAlign;
}
export interface ShadcnAlertDialogHeaderExposes {}
export interface ShadcnAlertDialogFooterProps extends ShadcnStyleProps {}
export interface ShadcnAlertDialogFooterExposes {}

/** Optional bounded-label wrapping is a Proto UI extension, not the default upstream size. */
export interface ShadcnAlertDialogActionProps extends BaseActionProps, ShadcnStyleProps {
  variant?: ShadcnAlertDialogActionVariant;
  size?: ShadcnAlertDialogActionSize;
  wrap?: boolean;
}
export interface ShadcnAlertDialogCancelProps extends BaseCancelProps, ShadcnStyleProps {
  variant?: ShadcnAlertDialogActionVariant;
  size?: ShadcnAlertDialogActionSize;
  wrap?: boolean;
}
