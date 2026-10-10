import type {
  ExposeEvent,
  ExposeMethod,
  ExposeState,
  State,
  FocusRequestOptions,
} from '@proto.ui/core';
export interface CheckboxGroupRootProps {
  value?: string[];
  defaultValue?: string[];
  disabled?: boolean;
  readOnly?: boolean;
  ariaLabel?: string;
}
export interface CheckboxGroupItemProps {
  value?: string;
  disabled?: boolean;
}
export type CheckboxGroupState = {
  checked: State<boolean>;
  indeterminate: State<boolean>;
  disabled: State<boolean>;
  readOnly: State<boolean>;
};
export type CheckboxGroupRootExposes = {
  checked: ExposeState<boolean>;
  indeterminate: ExposeState<boolean>;
  disabled: ExposeState<boolean>;
  readOnly: ExposeState<boolean>;
  resetValue: ExposeMethod<() => boolean>;
  focusSelf: ExposeMethod<() => void>;
  __focus: ExposeMethod<() => void>;
  getValue: ExposeMethod<() => string[]>;
  requestToggle: ExposeMethod<(value: string) => boolean>;
  requestAll: ExposeMethod<() => boolean>;
  valueChange: ExposeEvent<{ value: string[] }>;
  __itemsChanged: ExposeMethod<() => void>;
};
export type CheckboxGroupItemExposes = {
  checked: ExposeState<boolean>;
  indeterminate: ExposeState<boolean>;
  disabled: ExposeState<boolean>;
  readOnly: ExposeState<boolean>;
  focused: ExposeState<boolean>;
  focusVisible: ExposeState<boolean>;
  focusSelf: ExposeMethod<(options?: FocusRequestOptions) => void>;
  __groupItem: ExposeMethod<() => { value: string; disabled: boolean }>;
};
export type CheckboxGroupRootAsHookContract = { state: CheckboxGroupState };
export type CheckboxGroupItemAsHookContract = {
  state: CheckboxGroupState & { focused: State<boolean>; focusVisible: State<boolean> };
};
