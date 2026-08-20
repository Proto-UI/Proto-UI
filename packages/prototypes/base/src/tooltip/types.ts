import type { ExposeEvent, ExposeMethod, ExposeState, State } from '@proto.ui/core';
import type { TransitionExposes, TransitionHandles, TransitionProps } from '../transition/types';

export type TooltipSide = 'top' | 'right' | 'bottom' | 'left';
export type TooltipAlign = 'start' | 'center' | 'end';

export interface TooltipGroupProps {
  openDelay?: number;
  closeDelay?: number;
  skipDelay?: number;
}

export type TooltipGroupExposes = {};
export type TooltipGroupAsHookContract = {};

export interface TooltipRootProps {
  open?: boolean;
  defaultOpen?: boolean;
  disabled?: boolean;
  openDelay?: number;
  closeDelay?: number;
}

export type TooltipRootExposes = {
  open: ExposeState<boolean>;
  openTooltip: ExposeMethod<(reason?: string) => void>;
  close: ExposeMethod<(reason?: string) => void>;
  toggle: ExposeMethod<(reason?: string) => void>;
  openChange: ExposeEvent<{ open: boolean; reason: string | null }>;
};

export type TooltipRootStateHandles = { open: State<boolean> };
export type TooltipRootAsHookContract = { state: TooltipRootStateHandles };

export interface TooltipTriggerProps {
  disabled?: boolean;
}

export type TooltipTriggerExposes = {
  disabled: ExposeState<boolean>;
  hovered: ExposeState<boolean>;
  focused: ExposeState<boolean>;
  focusVisible: ExposeState<boolean>;
  focusSelf: ExposeMethod<(options?: { reason?: 'programmatic' | 'keyboard' | 'pointer' }) => void>;
};

export type TooltipTriggerStateHandles = {
  disabled: State<boolean>;
  hovered: State<boolean>;
  focused: State<boolean>;
  focusVisible: State<boolean>;
};
export type TooltipTriggerAsHookContract = { state: TooltipTriggerStateHandles };

export type TooltipContentProps = TransitionProps & {
  side?: TooltipSide;
  align?: TooltipAlign;
  sideOffset?: number;
  alignOffset?: number;
  avoidCollisions?: boolean;
  collisionPadding?: number;
};

export type TooltipContentExposes = TransitionExposes & { open: ExposeState<boolean> };
export type TooltipContentStateHandles = { open: State<boolean> };
export type TooltipContentAsHookContract = {
  state: TooltipContentStateHandles;
  asHooks: { asTransition: TransitionHandles };
};
export type TooltipContentHandles = {
  stateHandles: { open: State<boolean> };
  asTransition: TransitionHandles;
};
