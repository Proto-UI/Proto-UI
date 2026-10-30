import type {
  DialogCloseAsHookContract,
  DialogCloseExposes,
  DialogCloseProps,
  DialogContentAsHookContract,
  DialogContentExposes,
  DialogDescriptionAsHookContract,
  DialogDescriptionExposes,
  DialogDescriptionProps,
  DialogMaskAsHookContract,
  DialogMaskExposes,
  DialogMaskProps,
  DialogRootAsHookContract,
  DialogRootExposes,
  DialogRootProps,
  DialogTitleAsHookContract,
  DialogTitleExposes,
  DialogTitleProps,
  DialogTriggerAsHookContract,
  DialogTriggerExposes,
  DialogTriggerProps,
} from '@proto.ui/prototypes-base/dialog';
import type { ShadcnStyleProps } from '../style-scope';

export type ShadcnDialogRootProps = DialogRootProps & ShadcnStyleProps;
export type ShadcnDialogRootExposes = DialogRootExposes;
export type ShadcnDialogRootAsHookContract = DialogRootAsHookContract;

export type ShadcnDialogTriggerProps = DialogTriggerProps & ShadcnStyleProps;
export type ShadcnDialogTriggerExposes = DialogTriggerExposes;
export type ShadcnDialogTriggerAsHookContract = DialogTriggerAsHookContract;

// Keep the translated Shadcn surface at its own public boundary. Internal
// Transition capabilities are configured through the nested asHook handle.
export type ShadcnDialogMaskProps = Pick<DialogMaskProps, 'passthrough'> & ShadcnStyleProps;
export type ShadcnDialogMaskExposes = Pick<DialogMaskExposes, 'transitionState' | 'isPresent'>;
export type ShadcnDialogMaskAsHookContract = DialogMaskAsHookContract;

export interface ShadcnDialogContentProps extends ShadcnStyleProps {}
export type ShadcnDialogContentExposes = Pick<
  DialogContentExposes,
  'open' | 'transitionState' | 'isPresent'
>;
export type ShadcnDialogContentAsHookContract = DialogContentAsHookContract;

export type ShadcnDialogTitleProps = DialogTitleProps & ShadcnStyleProps;
export type ShadcnDialogTitleExposes = DialogTitleExposes;
export type ShadcnDialogTitleAsHookContract = DialogTitleAsHookContract;

export type ShadcnDialogDescriptionProps = DialogDescriptionProps & ShadcnStyleProps;
export type ShadcnDialogDescriptionExposes = DialogDescriptionExposes;
export type ShadcnDialogDescriptionAsHookContract = DialogDescriptionAsHookContract;

export type ShadcnDialogCloseProps = DialogCloseProps & ShadcnStyleProps;
export type ShadcnDialogCloseExposes = DialogCloseExposes;
export type ShadcnDialogCloseAsHookContract = DialogCloseAsHookContract;
