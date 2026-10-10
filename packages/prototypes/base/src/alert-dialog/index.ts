import alertDialogRoot from './root.proto';

export type {
  AlertDialogCancelAsHookContract,
  AlertDialogCancelExposes,
  AlertDialogCancelProps,
  AlertDialogContentAsHookContract,
  AlertDialogContentExposes,
  AlertDialogContentHandles,
  AlertDialogContentProps,
  AlertDialogDescriptionAsHookContract,
  AlertDialogDescriptionExposes,
  AlertDialogDescriptionProps,
  AlertDialogMaskAsHookContract,
  AlertDialogMaskExposes,
  AlertDialogMaskHandles,
  AlertDialogMaskProps,
  AlertDialogRootAsHookContract,
  AlertDialogRootExposes,
  AlertDialogRootProps,
  AlertDialogTitleAsHookContract,
  AlertDialogTitleExposes,
  AlertDialogTitleProps,
  AlertDialogTriggerAsHookContract,
  AlertDialogTriggerExposes,
  AlertDialogTriggerProps,
} from './types';
export type { AlertDialogContextValue } from './shared';

export { ALERT_DIALOG_CONTEXT, ALERT_DIALOG_FAMILY } from './shared';
export { asAlertDialogRoot, default as alertDialogRoot } from './root.proto';
export { asAlertDialogTrigger, default as alertDialogTrigger } from './trigger.proto';
export { asAlertDialogMask, default as alertDialogMask } from './overlay.proto';
export { asAlertDialogContent, default as alertDialogContent } from './content.proto';
export { asAlertDialogTitle, default as alertDialogTitle } from './title.proto';
export { asAlertDialogDescription, default as alertDialogDescription } from './description.proto';
export { asAlertDialogCancel, default as alertDialogCancel } from './cancel.proto';

export default alertDialogRoot;

export { asAlertDialogAction, default as alertDialogAction } from './action.proto';
export type {
  AlertDialogActionProps,
  AlertDialogActionExposes,
  AlertDialogActionAsHookContract,
} from './types';
