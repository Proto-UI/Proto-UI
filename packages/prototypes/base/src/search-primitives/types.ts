import type {
  ExposeEvent,
  ExposeMethod,
  ExposeState,
  State,
  FocusRequestOptions,
} from '@proto.ui/core';
import type { TransitionProps, TransitionExposes } from '../transition/types';
export interface SearchRootProps {
  value?: string;
  defaultValue?: string;
  inputValue?: string;
  defaultInputValue?: string;
  open?: boolean;
  defaultOpen?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  filter?: boolean;
  loop?: boolean;
  a11yLabel?: string;
}
export type SearchRootExposes = {
  value: ExposeState<string>;
  inputValue: ExposeState<string>;
  open: ExposeState<boolean>;
  visibleCount: ExposeState<number>;
  openPopup: ExposeMethod<() => void>;
  close: ExposeMethod<() => void>;
  setInputValue: ExposeMethod<(value: string, composing?: boolean) => void>;
  select: ExposeMethod<(value: string, reason?: string) => boolean>;
  __navigate: ExposeMethod<(direction: string) => void>;
  __refresh: ExposeMethod<() => void>;
  __activate: ExposeMethod<(id: string) => void>;
  valueChange: ExposeEvent<{ value: string; textValue: string; reason: string }>;
  inputValueChange: ExposeEvent<{ value: string; composing: boolean }>;
  openChange: ExposeEvent<{ open: boolean; reason: string }>;
  execute: ExposeEvent<{ value: string; textValue: string; reason: string }>;
};
export type SearchRootAsHookContract = {
  state: {
    value: State<string>;
    inputValue: State<string>;
    open: State<boolean>;
    visibleCount: State<number>;
  };
};
export interface SearchInputProps {
  placeholder?: string;
  a11yLabel?: string;
  name?: string;
}
export type SearchInputExposes = {
  focused: ExposeState<boolean>;
  focusVisible: ExposeState<boolean>;
  composing: ExposeState<boolean>;
  disabled: ExposeState<boolean>;
  focusSelf: ExposeMethod<(options?: FocusRequestOptions) => void>;
};
export type SearchInputAsHookContract = {
  state: {
    focused: State<boolean>;
    focusVisible: State<boolean>;
    composing: State<boolean>;
    disabled: State<boolean>;
  };
};
export type SearchContentProps = TransitionProps & {
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
  collisionPadding?: number;
};
export type SearchContentExposes = TransitionExposes & { open: ExposeState<boolean> };
export type SearchContentAsHookContract = { state: { open: State<boolean> } };
export interface SearchItemProps {
  value: string;
  textValue?: string;
  keywords?: string;
  disabled?: boolean;
}
export type SearchItemExposes = {
  selected: ExposeState<boolean>;
  active: ExposeState<boolean>;
  visible: ExposeState<boolean>;
  disabled: ExposeState<boolean>;
  select: ExposeEvent<{ value: string }>;
};
export type SearchItemAsHookContract = {
  state: {
    selected: State<boolean>;
    active: State<boolean>;
    visible: State<boolean>;
    disabled: State<boolean>;
  };
};
export interface SearchEmptyProps {}
export type SearchEmptyExposes = { visible: ExposeState<boolean> };
export type SearchEmptyAsHookContract = { state: { visible: State<boolean> } };
export interface SearchTriggerProps {
  disabled?: boolean;
}
export type SearchTriggerExposes = {
  disabled: ExposeState<boolean>;
  focused: ExposeState<boolean>;
  focusVisible: ExposeState<boolean>;
};
export type SearchTriggerAsHookContract = {
  state: { disabled: State<boolean>; focused: State<boolean>; focusVisible: State<boolean> };
};
