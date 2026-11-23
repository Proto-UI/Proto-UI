import type {
  AsHookResult,
  ExposeEvent,
  ExposeMethod,
  ExposeState,
  FocusRequestOptions,
  ObservedStateHandle,
  State,
} from '@proto.ui/core';
import type { CollapsibleOpenReason } from './shared';
import type { TransitionHandles } from '../transition/types';

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
export type CollapsibleRootAsHookContract = {
  asHooks: {
    useOpenState: AsHookResult<CollapsibleRootProps, { state: CollapsibleRootStateHandles }>;
  };
};

export interface CollapsibleTriggerProps {
  disabled?: boolean;
}

export type CollapsibleTriggerStateHandles = {
  expanded: State<boolean>;
  disabled: State<boolean>;
  hovered: State<boolean>;
  pressed: State<boolean>;
  focused: ObservedStateHandle<boolean, CollapsibleTriggerProps>;
  focusVisible: ObservedStateHandle<boolean, CollapsibleTriggerProps>;
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
  bindPresence: ExposeMethod<(transition: TransitionHandles) => void>;
};

export type CollapsibleContentStateHandles = {
  open: State<boolean>;
  hidden: State<boolean>;
};

export type CollapsibleContentAsHookContract = { state: CollapsibleContentStateHandles };
export type CollapsibleContentHandles = AsHookResult<
  CollapsibleContentProps,
  CollapsibleContentAsHookContract
> & {
  bindPresence(transition: TransitionHandles): void;
};
