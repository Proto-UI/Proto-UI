import { ExposeEvent, ExposeMethod, ExposeState, State } from '@proto.ui/core';

export interface TooltipRootProps {
  open?: boolean;
  defaultOpen?: boolean;
  disabled?: boolean;
  delay?: number;
}

export type TooltipRootExposes = {
  open: ExposeState<boolean>;
  openTooltip: ExposeMethod<(reason?: string) => void>;
  close: ExposeMethod<(reason?: string) => void>;
  toggle: ExposeMethod<(reason?: string) => void>;
};

export type TooltipRootStateHandles = {
  open: State<boolean>;
};

export type TooltipRootAsHookContract = {
  state: TooltipRootStateHandles;
};

export interface TooltipTriggerProps {
  disabled?: boolean;
}

export type TooltipTriggerExposes = {
  disabled: ExposeState<boolean>;
  hovered: ExposeState<boolean>;
  focused: ExposeState<boolean>;
  focusVisible: ExposeState<boolean>;
  pressed: ExposeState<boolean>;
  click: ExposeEvent<void>;
};

export type TooltipTriggerAsHookContract = {
  event: { click: void };
};

export interface TooltipContentProps {}

export type TooltipContentExposes = {
  open: ExposeState<boolean>;
};

export type TooltipContentStateHandles = {
  open: State<boolean>;
};

export type TooltipContentAsHookContract = {
  state: TooltipContentStateHandles;
};
