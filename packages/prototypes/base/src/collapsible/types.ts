import type {
  ExposeEvent,
  ExposeMethod,
  ExposeState,
  FocusRequestOptions,
  State,
} from '@proto.ui/core';
import type { CollapsibleOpenReason } from './shared';

export interface CollapsibleRootProps {
  open?: boolean;
  defaultOpen?: boolean;
  disabled?: boolean;
}

export type CollapsibleRootExposes = {
  open: ExposeState<boolean>;
  openCollapsible: ExposeMethod<(reason?: CollapsibleOpenReason) => void>;
  close: ExposeMethod<(reason?: CollapsibleOpenReason) => void>;
  toggle: ExposeMethod<(reason?: CollapsibleOpenReason) => void>;
  openChange: ExposeEvent<{ open: boolean; reason: CollapsibleOpenReason }>;
};

export type CollapsibleRootStateHandles = { open: State<boolean> };
export type CollapsibleRootAsHookContract = { state: CollapsibleRootStateHandles };

export interface CollapsibleTriggerProps {
  disabled?: boolean;
}

export type CollapsibleTriggerStateHandles = {
  expanded: State<boolean>;
  disabled: State<boolean>;
  hovered: State<boolean>;
  pressed: State<boolean>;
  focused: State<boolean>;
  focusVisible: State<boolean>;
};

export type CollapsibleTriggerExposes = {
  expanded: ExposeState<boolean>;
  disabled: ExposeState<boolean>;
  hovered: ExposeState<boolean>;
  pressed: ExposeState<boolean>;
  focused: ExposeState<boolean>;
  focusVisible: ExposeState<boolean>;
  focusSelf: ExposeMethod<(options?: FocusRequestOptions) => void>;
};

export type CollapsibleTriggerAsHookContract = { state: CollapsibleTriggerStateHandles };

export interface CollapsibleContentProps {
  keepMounted?: boolean;
}

export type CollapsibleContentExposes = {
  open: ExposeState<boolean>;
  hidden: ExposeState<boolean>;
};

export type CollapsibleContentStateHandles = {
  open: State<boolean>;
  hidden: State<boolean>;
};

export type CollapsibleContentAsHookContract = { state: CollapsibleContentStateHandles };
