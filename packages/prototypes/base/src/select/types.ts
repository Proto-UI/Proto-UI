import type {
  ObservedStateHandle,
  BorrowedStateHandle,
  ExposeEvent,
  ExposeMethod,
  ExposeState,
  FocusRequestOptions,
  State,
} from '@proto.ui/core';
import type {
  CollectionExposes,
  CollectionItemExposes,
  CollectionItemSnapshotExposed as CollectionItemSnapshot,
} from '@proto.ui/core';
import type { SelectFocusReason, SelectOpenRequest, SelectValueRequest } from './shared';
import type { TransitionExposes, TransitionHandles, TransitionProps } from '../transition/types';

export interface SelectRootProps {
  open?: boolean;
  defaultOpen?: boolean;
  value?: string;
  defaultValue?: string;
  disabled?: boolean;
  readOnly?: boolean;
  closeOnSelect?: boolean;
  /** Item-aligned composition layout policy. Omitted retains intrinsic upstream parts. */
  itemSizing?: 'intrinsic' | 'match-trigger';
}

export type SelectRootExposes = {
  open: ExposeState<boolean>;
  value: ExposeState<string>;
  textValue: ExposeState<string>;
  openDropdown: ExposeMethod<(reason?: string) => void>;
  close: ExposeMethod<(reason?: string) => void>;
  toggle: ExposeMethod<(reason?: string) => void>;
  requestOpen: ExposeMethod<(request: SelectOpenRequest) => boolean>;
  requestValue: ExposeMethod<(request: SelectValueRequest) => boolean>;
  openChange: ExposeEvent<{
    open: boolean;
    reason: string | null;
    focusReason: SelectFocusReason | null;
  }>;
  valueChange: ExposeEvent<{
    value: string;
    textValue: string;
    reason: SelectFocusReason;
  }>;
} & CollectionExposes;

export type SelectRootStateHandles = {
  open: State<boolean>;
  value: State<string>;
  textValue: State<string>;
};
export type SelectRootAsHookContract = { state: SelectRootStateHandles };

export interface SelectTriggerProps {
  /** Stable author name, separate from the selected Value; Field label takes precedence. */
  accessibleLabel?: string;
  disabled?: boolean;
}

export type SelectTriggerExposes = {
  disabled: ExposeState<boolean>;
  hovered: ExposeState<boolean>;
  focused: ExposeState<boolean>;
  focusVisible: ExposeState<boolean>;
  pressed: ExposeState<boolean>;
  placeholder: ExposeState<boolean>;
  focusSelf: ExposeMethod<(options?: FocusRequestOptions) => void>;
};

export type SelectCommandStateHandles = {
  disabled: State<boolean>;
  hovered: State<boolean>;
  focused: ObservedStateHandle<boolean, SelectTriggerProps>;
  focusVisible: ObservedStateHandle<boolean, SelectTriggerProps>;
  pressed: State<boolean>;
};
export type SelectTriggerAsHookContract = {
  state: SelectCommandStateHandles & { placeholder: State<boolean> };
};

export interface SelectValueProps {
  placeholder?: string;
}

export type SelectValueExposes = { displayValue: ExposeState<string> };
export type SelectValueStateHandles = { displayValue: State<string> };
export type SelectValueAsHookContract = { state: SelectValueStateHandles };

export type SelectContentProps = TransitionProps & {
  position?: 'popper' | 'item-aligned';
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
  alignOffset?: number;
  avoidCollisions?: boolean;
  collisionPadding?: number;
};

export type SelectContentExposes = TransitionExposes & {
  /** @internal Same-domain Trigger cancels automatic focus for the current open epoch. */
  __cancelPendingEntry: ExposeMethod<() => void>;
  alignmentDiagnostic: ExposeState<string>;
  open: ExposeState<boolean>;
  focusFirst: ExposeMethod<() => void>;
  focusLast: ExposeMethod<() => void>;
  focusNext: ExposeMethod<() => void>;
  focusPrev: ExposeMethod<() => void>;
  focusSelected: ExposeMethod<() => void>;
};
export type SelectContentStateHandles = { open: State<boolean>; alignmentFull: State<boolean> };
export type SelectContentAsHookContract = {
  state: SelectContentStateHandles;
  asHooks: { asTransition: TransitionHandles };
};
export type SelectContentHandles = {
  stateHandles: {
    open: BorrowedStateHandle<boolean, SelectContentProps>;
    alignmentFull: BorrowedStateHandle<boolean, SelectContentProps>;
  };
  asTransition: TransitionHandles;
};

export interface SelectItemProps {
  /** Explicit intrinsic layout opts this row out of the inherited match policy. */
  itemSizing?: 'inherit' | 'intrinsic';
  disabled?: boolean;
  value?: string;
  textValue?: string;
  closeOnSelect?: boolean;
}

export type SelectItemExposes = {
  disabled: ExposeState<boolean>;
  hovered: ExposeState<boolean>;
  focused: ExposeState<boolean>;
  focusVisible: ExposeState<boolean>;
  pressed: ExposeState<boolean>;
  active: ExposeState<boolean>;
  selected: ExposeState<boolean>;
  focusSelf: ExposeMethod<(options?: FocusRequestOptions) => void>;
  select: ExposeEvent<{ value: string; reason: SelectFocusReason }>;
} & CollectionItemExposes;

export type SelectItemAsHookContract = {
  state: SelectCommandStateHandles & { active: State<boolean>; selected: State<boolean> };
};

export type SelectItemSnapshot = CollectionItemSnapshot &
  Readonly<{ value: string; textValue: string; disabled: boolean }>;

export type SelectGroupProps = {};
export type SelectGroupExposes = {};
export type SelectGroupAsHookContract = {};

export type SelectLabelProps = {};
export type SelectLabelExposes = {};
export type SelectLabelAsHookContract = {};

export type SelectSeparatorProps = {};
export type SelectSeparatorExposes = {};
export type SelectSeparatorAsHookContract = {};
