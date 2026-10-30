export { default as alertDialogRoot } from './root.proto';
export { default as alertDialogTrigger } from './trigger.proto';
export { default as alertDialogContent } from './content.proto';
export { default as alertDialogTitle } from './title.proto';
export { default as alertDialogDescription } from './description.proto';
export { default as alertDialogCancel } from './cancel.proto';
export { default as alertDialogAction } from './action.proto';
export { default as alertDialogMask } from './mask.proto';
export { default } from './root.proto';
export type {
  AlertDialogRootExposes,
  AlertDialogTriggerExposes,
  AlertDialogContentExposes,
  AlertDialogTitleExposes,
  AlertDialogDescriptionExposes,
  AlertDialogCancelExposes,
  AlertDialogActionExposes,
  AlertDialogMaskExposes,
} from '@proto.ui/prototypes-base/alert-dialog';

export { default as alertDialogHeader } from './header.proto';
export { default as alertDialogFooter } from './footer.proto';
export type {
  AlertDialogRootProps,
  AlertDialogTriggerProps,
  AlertDialogContentProps,
  AlertDialogTitleProps,
  AlertDialogDescriptionProps,
  AlertDialogMaskProps,
  ShadcnAlertDialogActionProps,
  ShadcnAlertDialogActionProps as AlertDialogActionProps,
  ShadcnAlertDialogCancelProps,
  ShadcnAlertDialogCancelProps as AlertDialogCancelProps,
  ShadcnAlertDialogHeaderProps,
  ShadcnAlertDialogHeaderExposes,
  ShadcnAlertDialogFooterProps,
  ShadcnAlertDialogFooterExposes,
} from './types';
