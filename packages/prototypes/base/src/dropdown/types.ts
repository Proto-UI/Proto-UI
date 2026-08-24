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
import type { DropdownFocusReason, DropdownOpenRequest } from './shared';
import type { TransitionExposes, TransitionHandles, TransitionProps } from '../transition/types';

export interface DropdownRootProps {
  // P-BASE-DROPDOWN-MENU-PROPS
  open?: boolean;
  defaultOpen?: boolean;
  disabled?: boolean;
  closeOnItemCommit?: boolean;
  openEntry?: DropdownOpenEntry;
  openEntryValue?: string;
}

export type DropdownRootExposes = {
  // P-BASE-DROPDOWN-MENU-REQUESTS
  open: ExposeState<boolean>;
  openDropdown: ExposeMethod<(reason?: string) => void>;
  close: ExposeMethod<(reason?: string) => void>;
  toggle: ExposeMethod<(reason?: string) => void>;
  requestOpen: ExposeMethod<(request: DropdownOpenRequest) => boolean>;
  openChange: ExposeEvent<{
    open: boolean;
    reason: string | null;
    focusReason: DropdownFocusReason | null;
  }>;
} & CollectionExposes;

export type DropdownRootStateHandles = { open: State<boolean> };
export type DropdownRootAsHookContract = { state: DropdownRootStateHandles };

export interface DropdownTriggerProps {
  disabled?: boolean;
}

export type DropdownTriggerExposes = {
  disabled: ExposeState<boolean>;
  hovered: ExposeState<boolean>;
  focused: ExposeState<boolean>;
  focusVisible: ExposeState<boolean>;
  pressed: ExposeState<boolean>;
  focusSelf: ExposeMethod<(options?: FocusRequestOptions) => void>;
};

export type DropdownCommandStateHandles = {
  disabled: State<boolean>;
  hovered: State<boolean>;
  focused: State<boolean>;
  focusVisible: State<boolean>;
  pressed: State<boolean>;
};

export type DropdownTriggerAsHookContract = { state: DropdownCommandStateHandles };

export type DropdownContentProps = TransitionProps & {
  // P-BASE-DROPDOWN-MENU-CONTENT-POSITION
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
  alignOffset?: number;
  avoidCollisions?: boolean;
  collisionPadding?: number;
  // P-BASE-DROPDOWN-MENU-CONTENT-ANCHOR-TRANSFORM
  excludeAnchorTranslation?: boolean;
};

export type DropdownContentExposes = TransitionExposes & {
  open: ExposeState<boolean>;
  focusFirst: ExposeMethod<() => void>;
  focusLast: ExposeMethod<() => void>;
  focusNext: ExposeMethod<() => void>;
  focusPrev: ExposeMethod<() => void>;
};

export type DropdownContentStateHandles = { open: State<boolean> };
export type DropdownContentAsHookContract = {
  state: DropdownContentStateHandles;
  asHooks: { asTransition: TransitionHandles };
};
export type DropdownContentHandles = {
  stateHandles: { open: BorrowedStateHandle<boolean, DropdownContentProps> };
  asTransition: TransitionHandles;
};

export interface DropdownItemProps {
  disabled?: boolean;
  value?: string;
  textValue?: string;
  closeOnCommit?: boolean;
}

export type DropdownItemExposes = {
  disabled: ExposeState<boolean>;
  hovered: ExposeState<boolean>;
  focused: ExposeState<boolean>;
  focusVisible: ExposeState<boolean>;
  pressed: ExposeState<boolean>;
  active: ExposeState<boolean>;
  focusSelf: ExposeMethod<(options?: FocusRequestOptions) => void>;
  // P-BASE-DROPDOWN-MENU-ITEM-SELECT
  select: ExposeEvent<{ value: string; reason: DropdownFocusReason }>;
} & CollectionItemExposes;

export type DropdownItemAsHookContract = {
  state: DropdownCommandStateHandles & { active: State<boolean> };
};

export type DropdownOpenEntry = 'active-or-first' | 'first' | 'last' | 'value-or-first';

export type DropdownMenuItemSnapshot = CollectionItemSnapshot &
  Readonly<{ value: string; textValue: string; disabled: boolean }>;
