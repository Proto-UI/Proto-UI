import type {
  ObservedStateHandle,
  BorrowedStateHandle,
  ExposeEvent,
  ExposeMethod,
  ExposeState,
  State,
} from '@proto.ui/core';
import type { DialogOpenFocusReason } from './shared';
import type { TransitionExposes, TransitionHandles, TransitionProps } from '../transition/types';

export interface DialogRootProps {
  // P-BASE-DIALOG-PROPS
  open?: boolean;
  defaultOpen?: boolean;
  disabled?: boolean;
  alert?: boolean;
  a11yLabel?: string;
}

export type DialogRootExposes = {
  // P-BASE-DIALOG-OPEN-EXPOSE
  open: ExposeState<boolean>;
  openDialog: ExposeMethod<(reason?: string) => void>;
  close: ExposeMethod<(reason?: string) => void>;
  toggle: ExposeMethod<(reason?: string) => void>;
  // P-BASE-DIALOG-OPEN-CHANGE
  openChange: ExposeEvent<{
    open: boolean;
    reason: string | null;
    focusReason: DialogOpenFocusReason | null;
  }>;
};

export type DialogRootStateHandles = {
  open: State<boolean>;
};

export type DialogRootAsHookContract = {
  state: DialogRootStateHandles;
};

export interface DialogTriggerProps {
  // P-BASE-DIALOG-TRIGGER-DISABLED
  disabled?: boolean;
}

export type DialogTriggerExposes = {
  // P-BASE-DIALOG-TRIGGER-COMMAND, P-BASE-DIALOG-TRIGGER-DISABLED
  disabled: ExposeState<boolean>;
  hovered: ExposeState<boolean>;
  focused: ExposeState<boolean>;
  focusVisible: ExposeState<boolean>;
  pressed: ExposeState<boolean>;
  focusSelf: ExposeMethod<(options?: { reason?: 'programmatic' | 'keyboard' | 'pointer' }) => void>;
};

export type DialogTriggerAsHookContract = {
  state: DialogCommandStateHandles;
};

export type DialogCommandStateHandles = {
  disabled: State<boolean>;
  hovered: State<boolean>;
  focused: ObservedStateHandle<boolean, DialogTriggerProps>;
  focusVisible: ObservedStateHandle<boolean, DialogTriggerProps>;
  pressed: State<boolean>;
};

export type DialogMaskProps = TransitionProps & {
  // P-BASE-DIALOG-MASK-PASSTHROUGH
  passthrough?: boolean;
};

export type DialogMaskExposes = TransitionExposes;

export type DialogMaskStateHandles = {
  open: State<boolean>;
};

export type DialogMaskAsHookContract = {
  state: DialogMaskStateHandles;
  asHooks: {
    asTransition: TransitionHandles;
  };
};

export type DialogMaskHandles = {
  stateHandles: {
    open: BorrowedStateHandle<boolean, DialogMaskProps>;
  };
  asTransition: TransitionHandles;
};

export type DialogContentProps = TransitionProps & {
  // P-BASE-DIALOG-CONTENT-ENTRY-POLICY
  // Applies to the next actual scope activation, not an active-view refocus.
  focusEntry?: 'auto' | 'manual';
};

export type DialogContentExposes = TransitionExposes & {
  // P-BASE-DIALOG-CONTENT-PRESENCE
  open: ExposeState<boolean>;
};

export type DialogContentStateHandles = {
  open: State<boolean>;
};

export type DialogContentAsHookContract = {
  state: DialogContentStateHandles;
  asHooks: {
    asTransition: TransitionHandles;
  };
};

export type DialogContentHandles = {
  stateHandles: {
    open: BorrowedStateHandle<boolean, DialogContentProps>;
  };
  asTransition: TransitionHandles;
};

export interface DialogTitleProps {}

export type DialogTitleExposes = {};

export type DialogTitleAsHookContract = {};

export interface DialogDescriptionProps {}

export type DialogDescriptionExposes = {};

export type DialogDescriptionAsHookContract = {};

export interface DialogCloseProps {
  // P-BASE-DIALOG-CLOSE-DISABLED
  disabled?: boolean;
}

export type DialogCloseExposes = {
  // P-BASE-DIALOG-CLOSE-COMMAND, P-BASE-DIALOG-CLOSE-DISABLED
  disabled: ExposeState<boolean>;
  hovered: ExposeState<boolean>;
  focused: ExposeState<boolean>;
  focusVisible: ExposeState<boolean>;
  pressed: ExposeState<boolean>;
  focusSelf: ExposeMethod<(options?: { reason?: 'programmatic' | 'keyboard' | 'pointer' }) => void>;
};

export type DialogCloseAsHookContract = {
  state: DialogCommandStateHandles;
};
