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

export type AlertDialogRootProps = BaseRootProps & ShadcnStyleProps;
export type AlertDialogTriggerProps = BaseTriggerProps & ShadcnStyleProps;
export type AlertDialogContentProps = BaseContentProps & ShadcnStyleProps;
export type AlertDialogMaskProps = BaseMaskProps & ShadcnStyleProps;
export type AlertDialogTitleProps = BaseTitleProps & ShadcnStyleProps;
export type AlertDialogDescriptionProps = BaseDescriptionProps & ShadcnStyleProps;

// Passive presentation parts add no interaction or configuration owner.
export interface ShadcnAlertDialogHeaderProps extends ShadcnStyleProps {}
export interface ShadcnAlertDialogHeaderExposes {}
export interface ShadcnAlertDialogFooterProps extends ShadcnStyleProps {}
export interface ShadcnAlertDialogFooterExposes {}

/** Optional bounded-label wrapping is a Proto UI extension, not the default upstream size. */
export interface ShadcnAlertDialogActionProps extends BaseActionProps, ShadcnStyleProps {
  wrap?: boolean;
}
export interface ShadcnAlertDialogCancelProps extends BaseCancelProps, ShadcnStyleProps {
  wrap?: boolean;
}
