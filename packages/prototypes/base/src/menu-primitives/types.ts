import type {
  ExposeState,
  ExposeEvent,
  ExposeMethod,
  State,
  FocusRequestOptions,
} from '@proto.ui/core';
import type { TransitionProps, TransitionExposes } from '../transition/types';
export interface MenuRootProps {
  value?: string;
  defaultValue?: string;
  disabled?: boolean;
  loop?: boolean;
  a11yLabel?: string;
}
export type MenuRootExposes = {
  value: ExposeState<string>;
  requestValue: ExposeMethod<(value: string, reason?: string) => boolean>;
  close: ExposeMethod<() => void>;
  __current: ExposeMethod<(id: string) => void>;
  __refresh: ExposeMethod<() => void>;
  __navigate: ExposeMethod<(direction: number) => void>;
  valueChange: ExposeEvent<{ value: string; reason: string }>;
};
export type MenuRootAsHookContract = { state: { value: State<string>; disabled: State<boolean> } };
export interface MenuTriggerProps {
  value: string;
  disabled?: boolean;
}
export type MenuTriggerExposes = {
  expanded: ExposeState<boolean>;
  disabled: ExposeState<boolean>;
  focused: ExposeState<boolean>;
  focusVisible: ExposeState<boolean>;
  focusSelf: ExposeMethod<(options?: FocusRequestOptions) => void>;
};
export type MenuTriggerAsHookContract = {
  state: {
    expanded: State<boolean>;
    disabled: State<boolean>;
    focused: State<boolean>;
    focusVisible: State<boolean>;
  };
};
export type MenuContentProps = TransitionProps & {
  value: string;
  sideOffset?: number;
  a11yLabel?: string;
};
export type MenuContentExposes = TransitionExposes & {
  open: ExposeState<boolean>;
  focusFirst: ExposeMethod<() => void>;
  focusLast: ExposeMethod<() => void>;
};
export type MenuContentAsHookContract = { state: { open: State<boolean> } };
export interface MenuItemProps {
  value?: string;
  textValue?: string;
  disabled?: boolean;
  closeOnSelect?: boolean;
}
export type MenuItemExposes = {
  disabled: ExposeState<boolean>;
  focused: ExposeState<boolean>;
  focusVisible: ExposeState<boolean>;
  focusSelf: ExposeMethod<(options?: FocusRequestOptions) => void>;
  select: ExposeEvent<{ value: string; menuValue: string }>;
};
export type MenuItemAsHookContract = {
  state: { disabled: State<boolean>; focused: State<boolean>; focusVisible: State<boolean> };
};
export interface MenuLinkProps extends MenuItemProps {
  href: string;
  current?: boolean;
  target?: '_self' | '_blank';
}
export type MenuLinkExposes = MenuItemExposes & {
  navigate: ExposeEvent<{ href: string; target: '_self' | '_blank'; modified: boolean }>;
};
export type MenuLinkAsHookContract = MenuItemAsHookContract;
