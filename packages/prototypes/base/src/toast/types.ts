import type { ExposeState, ExposeMethod, ExposeEvent, State } from '@proto.ui/core';
import type { TransitionProps, TransitionExposes } from '../transition/types';
export interface ToastViewportProps {
  a11yLabel?: string;
  hotkey?: string;
}
export type ToastViewportExposes = { focusFirst: ExposeMethod<() => void> };
export type ToastViewportAsHookContract = {};
export interface ToastRootProps extends TransitionProps {
  duration?: number;
  paused?: boolean;
  politeness?: 'polite' | 'assertive';
}
export type ToastRootExposes = TransitionExposes & {
  __setFocused: ExposeMethod<(id: string, focused: boolean) => void>;
  open: ExposeState<boolean>;
  paused: ExposeState<boolean>;
  openToast: ExposeMethod<() => void>;
  close: ExposeMethod<(reason?: string) => void>;
  pause: ExposeMethod<() => void>;
  resume: ExposeMethod<() => void>;
  openChange: ExposeEvent<{ open: boolean; reason: string }>;
};
export type ToastRootAsHookContract = { state: { open: State<boolean>; paused: State<boolean> } };
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
}
export type ToastCloseExposes = {
  disabled: ExposeState<boolean>;
  focused: ExposeState<boolean>;
  focusVisible: ExposeState<boolean>;
};
export type ToastActionExposes = ToastCloseExposes & { action: ExposeEvent<void> };
export type ToastCloseAsHookContract = {
  state: { disabled: State<boolean>; focused: State<boolean>; focusVisible: State<boolean> };
};
export type ToastActionAsHookContract = ToastCloseAsHookContract;
