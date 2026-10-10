import type {
  ExposeState,
  ExposeEvent,
  ExposeMethod,
  State,
  FocusRequestOptions,
} from '@proto.ui/core';
export interface ToolbarRootProps {
  disabled?: boolean;
  orientation?: 'horizontal' | 'vertical';
  loop?: boolean;
  a11yLabel?: string;
}
export type ToolbarRootExposes = {
  disabled: ExposeState<boolean>;
  setCurrent: ExposeMethod<(id: string) => void>;
  focusFirst: ExposeMethod<() => void>;
  focusLast: ExposeMethod<() => void>;
};
export type ToolbarRootAsHookContract = {
  state: { disabled: State<boolean>; orientation: State<string> };
};
export interface ToolbarButtonProps {
  disabled?: boolean;
  value?: string;
}
export type ToolbarButtonExposes = {
  disabled: ExposeState<boolean>;
  focused: ExposeState<boolean>;
  focusVisible: ExposeState<boolean>;
  focusSelf: ExposeMethod<(options?: FocusRequestOptions) => void>;
  action: ExposeEvent<{ value: string }>;
};
export type ToolbarButtonAsHookContract = {
  state: { disabled: State<boolean>; focused: State<boolean>; focusVisible: State<boolean> };
};
export interface ToolbarSeparatorProps {}
export type ToolbarSeparatorExposes = {};
export type ToolbarSeparatorAsHookContract = { state: { orientation: State<string> } };
