import type {
  BorrowedStateHandle,
  ExposeEvent,
  ExposeMethod,
  ExposeState,
  State,
} from '@proto.ui/core';
import type { AlertDialogOpenFocusReason } from './shared';
import type { TransitionExposes, TransitionHandles, TransitionProps } from '../transition/types';

export interface AlertDialogRootProps {
  open?: boolean;
  defaultOpen?: boolean;
  disabled?: boolean;
  a11yLabel?: string;
}

export type AlertDialogRootExposes = {
  open: ExposeState<boolean>;
  openAlertDialog: ExposeMethod<(reason?: string) => void>;
  close: ExposeMethod<(reason?: string) => void>;
  toggle: ExposeMethod<(reason?: string) => void>;

  openChange: ExposeEvent<{
    open: boolean;
    reason: string | null;
    focusReason: AlertDialogOpenFocusReason | null;
  }>;
};

export type AlertDialogRootStateHandles = {
  open: State<boolean>;
};

export type AlertDialogRootAsHookContract = {
  state: AlertDialogRootStateHandles;
};

export interface AlertDialogTriggerProps {
  disabled?: boolean;
}

export type AlertDialogTriggerExposes = {
  disabled: ExposeState<boolean>;
  hovered: ExposeState<boolean>;
  focused: ExposeState<boolean>;
  focusVisible: ExposeState<boolean>;
  pressed: ExposeState<boolean>;
  focusSelf: ExposeMethod<(options?: { reason?: 'programmatic' | 'keyboard' | 'pointer' }) => void>;
};

export type AlertDialogTriggerAsHookContract = {
  state: AlertDialogCommandStateHandles;
};

export type AlertDialogCommandStateHandles = {
  disabled: State<boolean>;
  hovered: State<boolean>;
  focused: State<boolean>;
  focusVisible: State<boolean>;
  pressed: State<boolean>;
};

export type AlertDialogMaskProps = TransitionProps & {
  passthrough?: boolean;
};

export type AlertDialogMaskExposes = TransitionExposes;

export type AlertDialogMaskStateHandles = {
  open: State<boolean>;
};

export type AlertDialogMaskAsHookContract = {
  state: AlertDialogMaskStateHandles;
  asHooks: {
    asTransition: TransitionHandles;
  };
};

export type AlertDialogMaskHandles = {
  stateHandles: {
    open: BorrowedStateHandle<boolean, AlertDialogMaskProps>;
  };
  asTransition: TransitionHandles;
};

export type AlertDialogContentProps = TransitionProps;

export type AlertDialogContentExposes = TransitionExposes & {
  open: ExposeState<boolean>;
};

export type AlertDialogContentStateHandles = {
  open: State<boolean>;
};

export type AlertDialogContentAsHookContract = {
  state: AlertDialogContentStateHandles;
  asHooks: {
    asTransition: TransitionHandles;
  };
};

export type AlertDialogContentHandles = {
  stateHandles: {
    open: BorrowedStateHandle<boolean, AlertDialogContentProps>;
  };
  asTransition: TransitionHandles;
};

export interface AlertDialogTitleProps {}

export type AlertDialogTitleExposes = {};

export type AlertDialogTitleAsHookContract = {};

export interface AlertDialogDescriptionProps {}

export type AlertDialogDescriptionExposes = {};

export type AlertDialogDescriptionAsHookContract = {};

export interface AlertDialogCancelProps {
  disabled?: boolean;
}

export type AlertDialogCancelExposes = {
  disabled: ExposeState<boolean>;
  hovered: ExposeState<boolean>;
  focused: ExposeState<boolean>;
  focusVisible: ExposeState<boolean>;
  pressed: ExposeState<boolean>;
  focusSelf: ExposeMethod<(options?: { reason?: 'programmatic' | 'keyboard' | 'pointer' }) => void>;
};

export type AlertDialogCancelAsHookContract = {
  state: AlertDialogCommandStateHandles;
};

export type AlertDialogActionProps = AlertDialogCancelProps;
export type AlertDialogActionExposes = AlertDialogCancelExposes & {
  action: ExposeEvent<{ reason: string }>;
};
export type AlertDialogActionAsHookContract = AlertDialogCancelAsHookContract;
