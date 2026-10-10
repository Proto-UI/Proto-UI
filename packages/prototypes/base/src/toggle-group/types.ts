import type {
  ExposeEvent,
  ExposeMethod,
  ExposeState,
  FocusRequestOptions,
  State,
} from '@proto.ui/core';
export interface ToggleGroupRootProps {
  value?: readonly string[];
  defaultValue?: readonly string[];
  multiple?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  orientation?: 'horizontal' | 'vertical';
  loop?: boolean;
  a11yLabel?: string;
}
export type ToggleGroupRootExposes = {
  disabled: ExposeState<boolean>;
  count: ExposeState<number>;
  getValue: ExposeMethod<() => readonly string[]>;
  requestToggle: ExposeMethod<(value: string) => boolean>;
  setCurrent: ExposeMethod<(id: string) => void>;
  focusFirst: ExposeMethod<() => void>;
  focusLast: ExposeMethod<() => void>;
  valueChange: ExposeEvent<{ value: readonly string[] }>;
};
export type ToggleGroupRootAsHookContract = { state: { disabled: State<boolean> } };
export interface ToggleGroupItemProps {
  value: string;
  disabled?: boolean;
}
export type ToggleGroupItemExposes = {
  active: ExposeState<boolean>;
  disabled: ExposeState<boolean>;
  focused: ExposeState<boolean>;
  focusVisible: ExposeState<boolean>;
  focusSelf: ExposeMethod<(options?: FocusRequestOptions) => void>;
};
export type ToggleGroupItemAsHookContract = {
  state: {
    active: State<boolean>;
    disabled: State<boolean>;
    focused: State<boolean>;
    focusVisible: State<boolean>;
  };
};
