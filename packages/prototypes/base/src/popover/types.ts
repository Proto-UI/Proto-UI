import type { useOpenState } from '../tools/use-open-state';
import type {
  BorrowedStateHandle,
  ExposeEvent,
  ExposeMethod,
  ExposeState,
  State,
} from '@proto.ui/core';
import type { PopoverOpenFocusReason } from './shared';
import type { TransitionExposes, TransitionHandles, TransitionProps } from '../transition/types';

export interface PopoverRootProps {
  open?: boolean;
  defaultOpen?: boolean;
  disabled?: boolean;
  a11yLabel?: string;
}

export type PopoverRootExposes = {
  open: ExposeState<boolean>;
  openPopover: ExposeMethod<(reason?: string) => void>;
  close: ExposeMethod<(reason?: string) => void>;
  toggle: ExposeMethod<(reason?: string) => void>;

  openChange: ExposeEvent<{
    open: boolean;
    reason: string | null;
    focusReason: PopoverOpenFocusReason | null;
  }>;
};

export type PopoverRootStateHandles = {
  open: State<boolean>;
};

/** Open is owned by the authored helper child, not this Root capture frame. */
export type PopoverRootAsHookContract = {
  asHooks: {
    useOpenState: ReturnType<typeof useOpenState>;
  };
};

export interface PopoverTriggerProps {
  disabled?: boolean;
}

export type PopoverTriggerExposes = {
  disabled: ExposeState<boolean>;
  hovered: ExposeState<boolean>;
  focused: ExposeState<boolean>;
  focusVisible: ExposeState<boolean>;
  pressed: ExposeState<boolean>;
  focusSelf: ExposeMethod<(options?: { reason?: 'programmatic' | 'keyboard' | 'pointer' }) => void>;
};

export type PopoverTriggerAsHookContract = {
  state: PopoverCommandStateHandles;
};

export type PopoverCommandStateHandles = {
  disabled: State<boolean>;
  hovered: State<boolean>;
  focused: State<boolean>;
  focusVisible: State<boolean>;
  pressed: State<boolean>;
};

export type PopoverContentProps = TransitionProps & {
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
  alignOffset?: number;
  collisionPadding?: number;
};

export type PopoverContentExposes = TransitionExposes & {
  open: ExposeState<boolean>;
};

export type PopoverContentStateHandles = {
  open: State<boolean>;
};

export type PopoverContentAsHookContract = {
  state: PopoverContentStateHandles;
  asHooks: {
    asTransition: TransitionHandles;
  };
};

export type PopoverContentHandles = {
  stateHandles: {
    open: BorrowedStateHandle<boolean, PopoverContentProps>;
  };
  asTransition: TransitionHandles;
};

export interface PopoverTitleProps {}

export type PopoverTitleExposes = {};

export type PopoverTitleAsHookContract = {};

export interface PopoverDescriptionProps {}

export type PopoverDescriptionExposes = {};

export type PopoverDescriptionAsHookContract = {};

export interface PopoverCloseProps {
  disabled?: boolean;
}

export type PopoverCloseExposes = {
  disabled: ExposeState<boolean>;
  hovered: ExposeState<boolean>;
  focused: ExposeState<boolean>;
  focusVisible: ExposeState<boolean>;
  pressed: ExposeState<boolean>;
  focusSelf: ExposeMethod<(options?: { reason?: 'programmatic' | 'keyboard' | 'pointer' }) => void>;
};

export type PopoverCloseAsHookContract = {
  state: PopoverCommandStateHandles;
};
