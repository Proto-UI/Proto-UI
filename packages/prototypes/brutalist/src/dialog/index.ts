import dialogClose from './close.proto';
import dialogContent from './content.proto';
import dialogCloseIcon from './close-icon.proto';
import dialogDescription from './description.proto';
import dialogMask from './overlay.proto';
import dialogRoot from './root.proto';
import dialogTitle from './title.proto';
import dialogTrigger from './trigger.proto';
import dialogHeader from './header.proto';
import dialogFooter from './footer.proto';

export type {
  BrutalistDialogRootProps,
  BrutalistDialogRootExposes,
  BrutalistDialogRootAsHookContract,
  BrutalistDialogTriggerProps,
  BrutalistDialogTriggerExposes,
  BrutalistDialogTriggerAsHookContract,
  BrutalistDialogMaskProps,
  BrutalistDialogMaskExposes,
  BrutalistDialogMaskAsHookContract,
  BrutalistDialogContentProps,
  BrutalistDialogContentExposes,
  BrutalistDialogContentAsHookContract,
  BrutalistDialogTitleProps,
  BrutalistDialogTitleExposes,
  BrutalistDialogTitleAsHookContract,
  BrutalistDialogDescriptionProps,
  BrutalistDialogDescriptionExposes,
  BrutalistDialogDescriptionAsHookContract,
  BrutalistDialogCloseProps,
  BrutalistDialogCloseExposes,
  BrutalistDialogCloseAsHookContract,
} from './types';

export {
  dialogRoot,
  dialogTrigger,
  dialogMask,
  dialogContent,
  dialogTitle,
  dialogDescription,
  dialogClose,
  dialogCloseIcon,
  dialogHeader,
  dialogFooter,
};

export { default as brutalistDialogRoot } from './root.proto';
export { default as brutalistDialogTrigger } from './trigger.proto';
export { default as brutalistDialogMask } from './overlay.proto';
export { default as brutalistDialogContent } from './content.proto';
export { default as brutalistDialogTitle } from './title.proto';
export { default as brutalistDialogDescription } from './description.proto';
export { default as brutalistDialogClose } from './close.proto';
export { default as brutalistDialogCloseIcon } from './close-icon.proto';
export { default as brutalistDialogHeader } from './header.proto';
export { default as brutalistDialogFooter } from './footer.proto';
