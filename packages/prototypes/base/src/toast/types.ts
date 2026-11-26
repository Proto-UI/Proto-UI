import type {
  ObservedStateHandle,
  ExposeState,
  ExposeMethod,
  ExposeEvent,
  State,
} from '@proto.ui/core';
import type { TransitionProps, TransitionExposes } from '../transition/types';

export type ToastPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export type ToastType = 'default' | 'success' | 'info' | 'warning' | 'error' | 'loading';

export type ToastSwipeDirection = 'right' | 'left' | 'up' | 'down' | 'none';

export type ToastStackTier = 'front' | 'second' | 'third' | 'back' | 'overflow';

export interface ToastViewportProps {
  a11yLabel?: string;
  hotkey?: string;
  position?: ToastPosition;
  expand?: boolean;
  visibleToasts?: number;
  duration?: number;
  swipeDirection?: ToastSwipeDirection;
}

export type ToastViewportExposes = {
  focusFirst: ExposeMethod<() => void>;
  pauseAll: ExposeMethod<() => void>;
  resumeAll: ExposeMethod<() => void>;
  dismissAll: ExposeMethod<(reason?: string) => void>;
  position: ExposeState<ToastPosition>;
  expanded: ExposeState<boolean>;
  paused: ExposeState<boolean>;
  hasOpen: ExposeState<boolean>;
};

export type ToastViewportAsHookContract = {
  state: {
    position: State<ToastPosition>;
    expanded: State<boolean>;
    paused: State<boolean>;
    hasOpen: State<boolean>;
  };
};

export interface ToastRootProps extends TransitionProps {
  duration?: number;
  paused?: boolean;
  politeness?: 'polite' | 'assertive';
  type?: ToastType;
  dismissible?: boolean;
  position?: ToastPosition;
}

export type ToastRootExposes = TransitionExposes & {
  __setFocused: ExposeMethod<(id: string, focused: boolean) => void>;
  open: ExposeState<boolean>;
  paused: ExposeState<boolean>;
  type: ExposeState<ToastType>;
  dismissible: ExposeState<boolean>;
  position: ExposeState<ToastPosition>;
  expanded: ExposeState<boolean>;
  stackTier: ExposeState<ToastStackTier>;
  /** Zero-based opening chronology, newest first; -1 while outside the open stack. */
  stackIndex: ExposeState<number>;
  /** Outside the configured visible window, without closing or restarting its timer. */
  limited: ExposeState<boolean>;
  openToast: ExposeMethod<() => void>;
  close: ExposeMethod<(reason?: string) => void>;
  pause: ExposeMethod<() => void>;
  resume: ExposeMethod<() => void>;
  openChange: ExposeEvent<{ open: boolean; reason: string }>;
};

export type ToastRootAsHookContract = {
  state: {
    open: State<boolean>;
    paused: State<boolean>;
    type: State<ToastType>;
    dismissible: State<boolean>;
    position: State<ToastPosition>;
    expanded: State<boolean>;
    stackTier: State<ToastStackTier>;
    stackIndex: State<number>;
    limited: State<boolean>;
  };
};

export interface ToastTitleProps {}
export interface ToastDescriptionProps {}
export type ToastTitleExposes = {};
export type ToastDescriptionExposes = {};
export type ToastTitleAsHookContract = {};
export type ToastDescriptionAsHookContract = {};

export interface ToastCloseProps {
  disabled?: boolean;
}

export interface ToastActionProps extends ToastCloseProps {
  a11yLabel?: string;
  keepOpen?: boolean;
}

export type ToastCloseExposes = {
  disabled: ExposeState<boolean>;
  focused: ExposeState<boolean>;
  focusVisible: ExposeState<boolean>;
};

export type ToastActionExposes = ToastCloseExposes & { action: ExposeEvent<void> };

export type ToastCloseAsHookContract = {
  state: {
    disabled: State<boolean>;
    focused: ObservedStateHandle<boolean, ToastCloseProps>;
    focusVisible: ObservedStateHandle<boolean, ToastCloseProps>;
  };
};

export type ToastActionAsHookContract = ToastCloseAsHookContract;
