import type {
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
import type { ContextMenuFocusReason, ContextMenuOpenRequest } from './shared';
import type { TransitionExposes, TransitionHandles, TransitionProps } from '../transition/types';

export interface ContextMenuRootProps {
  open?: boolean;
  defaultOpen?: boolean;
  disabled?: boolean;
  closeOnItemCommit?: boolean;
  openEntry?: ContextMenuOpenEntry;
  openEntryValue?: string;
}

export type ContextMenuRootExposes = {
  open: ExposeState<boolean>;
  openContextMenu: ExposeMethod<(reason?: string) => void>;
  close: ExposeMethod<(reason?: string) => void>;
  toggle: ExposeMethod<(reason?: string) => void>;
  requestOpen: ExposeMethod<(request: ContextMenuOpenRequest) => boolean>;
  openChange: ExposeEvent<{
    open: boolean;
    reason: string | null;
    focusReason: ContextMenuFocusReason | null;
  }>;
} & CollectionExposes;

export type ContextMenuRootStateHandles = { open: State<boolean> };
export type ContextMenuRootAsHookContract = { state: ContextMenuRootStateHandles };

export interface ContextMenuTriggerProps {
  disabled?: boolean;
}

export type ContextMenuTriggerExposes = {
  disabled: ExposeState<boolean>;
  hovered: ExposeState<boolean>;
  focused: ExposeState<boolean>;
  focusVisible: ExposeState<boolean>;
  pressed: ExposeState<boolean>;
  focusSelf: ExposeMethod<(options?: FocusRequestOptions) => void>;
};

export type ContextMenuCommandStateHandles = {
  disabled: State<boolean>;
  hovered: State<boolean>;
  focused: State<boolean>;
  focusVisible: State<boolean>;
  pressed: State<boolean>;
};

export type ContextMenuTriggerAsHookContract = { state: ContextMenuCommandStateHandles };

export type ContextMenuContentProps = TransitionProps & {
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
  alignOffset?: number;
  avoidCollisions?: boolean;
  collisionPadding?: number;

  excludeAnchorTranslation?: boolean;
};

export type ContextMenuContentExposes = TransitionExposes & {
  open: ExposeState<boolean>;
  focusFirst: ExposeMethod<() => void>;
  focusLast: ExposeMethod<() => void>;
  focusNext: ExposeMethod<() => void>;
  focusPrev: ExposeMethod<() => void>;
};

export type ContextMenuContentStateHandles = { open: State<boolean> };
export type ContextMenuContentAsHookContract = {
  state: ContextMenuContentStateHandles;
  asHooks: { asTransition: TransitionHandles };
};
export type ContextMenuContentHandles = {
  stateHandles: { open: BorrowedStateHandle<boolean, ContextMenuContentProps> };
  asTransition: TransitionHandles;
};

export interface ContextMenuItemProps {
  disabled?: boolean;
  value?: string;
  textValue?: string;
  closeOnCommit?: boolean;
}

export type ContextMenuItemExposes = {
  disabled: ExposeState<boolean>;
  hovered: ExposeState<boolean>;
  focused: ExposeState<boolean>;
  focusVisible: ExposeState<boolean>;
  pressed: ExposeState<boolean>;
  active: ExposeState<boolean>;
  focusSelf: ExposeMethod<(options?: FocusRequestOptions) => void>;

  select: ExposeEvent<{ value: string; reason: ContextMenuFocusReason }>;
} & CollectionItemExposes;

export type ContextMenuItemAsHookContract = {
  state: ContextMenuCommandStateHandles & { active: State<boolean> };
};

export type ContextMenuOpenEntry = 'active-or-first' | 'first' | 'last' | 'value-or-first';

export type ContextMenuMenuItemSnapshot = CollectionItemSnapshot &
  Readonly<{ value: string; textValue: string; disabled: boolean }>;
