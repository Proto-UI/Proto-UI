import type { ObservedStateHandle } from '@proto.ui/core';
import { ExposeEvent, ExposeMethod, ExposeState, FocusRequestOptions, State } from '@proto.ui/core';

export type CheckboxCheckedChangeDetail = {
  checked: boolean;
  indeterminate: boolean;
};

export interface CheckboxRootProps {
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  indeterminate?: boolean;
  defaultIndeterminate?: boolean;
}

export type CheckboxRootExposes = {
  disabled: ExposeState<boolean>;
  readOnly: ExposeState<boolean>;
  resetValue: ExposeMethod<() => boolean>;
  hovered: ExposeState<boolean>;
  focused: ExposeState<boolean>;
  focusVisible: ExposeState<boolean>;
  pressed: ExposeState<boolean>;
  checked: ExposeState<boolean>;
  focusSelf: ExposeMethod<(options?: FocusRequestOptions) => void>;
  indeterminate: ExposeState<boolean>;
  checkedChange: ExposeEvent<CheckboxCheckedChangeDetail>;
  indeterminateChange: ExposeEvent<{ indeterminate: boolean }>;
};

export type CheckboxRootStateHandles = {
  disabled: State<boolean>;
  readOnly: State<boolean>;
  hovered: State<boolean>;
  focused: ObservedStateHandle<boolean, CheckboxRootProps>;
  focusVisible: ObservedStateHandle<boolean, CheckboxRootProps>;
  pressed: State<boolean>;
  checked: State<boolean>;
  indeterminate: State<boolean>;
};

export type CheckboxRootAsHookContract = {
  state: CheckboxRootStateHandles;
  event: {
    checkedChange: CheckboxCheckedChangeDetail;
    indeterminateChange: { indeterminate: boolean };
  };
};

export interface CheckboxIndicatorProps {}

export type CheckboxIndicatorExposes = {
  checked: ExposeState<boolean>;
  indeterminate: ExposeState<boolean>;
  isChecked: ExposeMethod<() => boolean | null>;
  isIndeterminate: ExposeMethod<() => boolean | null>;
};

export type CheckboxIndicatorStateHandles = {
  checked: State<boolean>;
  indeterminate: State<boolean>;
};

export type CheckboxIndicatorAsHookContract = {
  state: CheckboxIndicatorStateHandles;
};
