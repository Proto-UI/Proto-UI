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

export type BrutalistDialogRootProps = DialogRootProps;
export type BrutalistDialogRootExposes = DialogRootExposes;
export type BrutalistDialogRootAsHookContract = DialogRootAsHookContract;

export type BrutalistDialogTriggerProps = DialogTriggerProps;
export type BrutalistDialogTriggerExposes = DialogTriggerExposes;
export type BrutalistDialogTriggerAsHookContract = DialogTriggerAsHookContract;

// Keep the translated Brutalist surface at its own public boundary. Internal
// Transition capabilities are configured through the nested asHook handle.
export type BrutalistDialogMaskProps = Pick<DialogMaskProps, 'passthrough'>;
export type BrutalistDialogMaskExposes = Pick<DialogMaskExposes, 'transitionState' | 'isPresent'>;
export type BrutalistDialogMaskAsHookContract = DialogMaskAsHookContract;

export interface BrutalistDialogContentProps {}
export type BrutalistDialogContentExposes = Pick<
  DialogContentExposes,
  'open' | 'transitionState' | 'isPresent'
>;
export type BrutalistDialogContentAsHookContract = DialogContentAsHookContract;

export type BrutalistDialogTitleProps = DialogTitleProps;
export type BrutalistDialogTitleExposes = DialogTitleExposes;
export type BrutalistDialogTitleAsHookContract = DialogTitleAsHookContract;

export type BrutalistDialogDescriptionProps = DialogDescriptionProps;
export type BrutalistDialogDescriptionExposes = DialogDescriptionExposes;
export type BrutalistDialogDescriptionAsHookContract = DialogDescriptionAsHookContract;

export type BrutalistDialogCloseProps = DialogCloseProps;
export type BrutalistDialogCloseExposes = DialogCloseExposes;
export type BrutalistDialogCloseAsHookContract = DialogCloseAsHookContract;
