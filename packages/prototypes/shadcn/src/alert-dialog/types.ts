import type {
  AlertDialogActionProps as BaseActionProps,
  AlertDialogCancelProps as BaseCancelProps,
} from '@proto.ui/prototypes-base/alert-dialog';

// Passive presentation parts add no interaction or configuration owner.
export interface ShadcnAlertDialogHeaderProps {}
export interface ShadcnAlertDialogHeaderExposes {}
export interface ShadcnAlertDialogFooterProps {}
export interface ShadcnAlertDialogFooterExposes {}

/** Optional bounded-label wrapping is a Proto UI extension, not the default upstream size. */
export interface ShadcnAlertDialogActionProps extends BaseActionProps {
  wrap?: boolean;
}
export interface ShadcnAlertDialogCancelProps extends BaseCancelProps {
  wrap?: boolean;
}
