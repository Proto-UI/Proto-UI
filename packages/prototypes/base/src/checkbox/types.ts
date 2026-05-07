import { ExposeEvent, ExposeMethod, ExposeState, State } from '@proto.ui/core';
import type {
  ToggleAsHookContract,
  ToggleExposes,
  ToggleProps,
  ToggleStateHandles,
} from '../toggle/types';

export interface CheckboxRootProps extends ToggleProps {
  indeterminate?: boolean;
  defaultIndeterminate?: boolean;
}

export type CheckboxRootExposes = ToggleExposes & {
  indeterminate: ExposeState<boolean>;
  indeterminateChange: ExposeEvent<{ indeterminate: boolean }>;
};

export type CheckboxRootStateHandles = ToggleStateHandles & {
  indeterminate: State<boolean>;
};

export type CheckboxRootAsHookContract = ToggleAsHookContract & {
  state: { indeterminate: State<boolean> };
  event: { indeterminateChange: { indeterminate: boolean } };
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
