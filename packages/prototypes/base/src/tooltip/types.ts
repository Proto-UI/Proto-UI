import { ExposeMethod, ExposeState, State } from '@proto.ui/core';

export interface TooltipGroupProps {
  skipDelayDuration?: number;
}

export type TooltipGroupExposes = {};

export type TooltipGroupAsHookContract = {};

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
};

export type TooltipTriggerAsHookContract = {};

export interface TooltipOverlayProps {}

export type TooltipOverlayExposes = {
  open: ExposeState<boolean>;
};

export type TooltipOverlayStateHandles = {
  open: State<boolean>;
};

export type TooltipOverlayAsHookContract = {
  state: TooltipOverlayStateHandles;
};

export interface TooltipContentProps {}

export type TooltipContentExposes = {};

export type TooltipContentAsHookContract = {};

export interface TooltipArrowProps {}

export type TooltipArrowExposes = {};

export type TooltipArrowAsHookContract = {};
