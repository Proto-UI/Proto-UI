import type { ExposeEvent, ExposeMethod, ExposeState, State } from '@proto.ui/core';
export interface NumberFieldRootProps {
  value?: number;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  readOnly?: boolean;
  ariaLabel?: string;
  name?: string;
}
export type NumberFieldRootExposes = {
  value: ExposeState<number>;
  draft: ExposeState<string>;
  disabled: ExposeState<boolean>;
  readOnly: ExposeState<boolean>;
  resetValue: ExposeMethod<() => boolean>;
  requestValue: ExposeMethod<(value: number) => boolean>;
  requestInput: ExposeMethod<(text: string, composing?: boolean) => boolean>;
  commitValue: ExposeMethod<() => void>;
  stepBy: ExposeMethod<(direction: number) => boolean>;
  valueChange: ExposeEvent<{ value: number }>;
  valueCommit: ExposeEvent<{ value: number }>;
};
export type NumberFieldRootAsHookContract = {
  state: {
    value: State<number>;
    draft: State<string>;
    disabled: State<boolean>;
    readOnly: State<boolean>;
  };
};
export interface NumberFieldPartProps {}

export type NumberFieldInputExposes = {
  value: ExposeState<number>;
  disabled: ExposeState<boolean>;
  readOnly: ExposeState<boolean>;
  focused: ExposeState<boolean>;
  focusVisible: ExposeState<boolean>;
  focusSelf: ExposeMethod<() => void>;
  resetValue: ExposeMethod<() => boolean>;
  __fieldInput: ExposeMethod<() => void>;
  __implicitSubmitEligible: ExposeMethod<() => boolean>;
};
export type NumberFieldControlExposes = NumberFieldInputExposes & {
  [K in keyof import('../field').FieldControlBindingStates]: ExposeState<boolean>;
};
export type NumberFieldStepExposes = {
  disabled: ExposeState<boolean>;
  focusVisible: ExposeState<boolean>;
};
export type NumberFieldLabelExposes = {};
