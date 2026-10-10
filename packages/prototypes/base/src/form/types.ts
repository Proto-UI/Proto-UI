import type {
  ExposeEvent,
  ExposeMethod,
  ExposeState,
  State,
  FocusRequestOptions,
} from '@proto.ui/core';
import type { FieldRootProps, FieldRootExposes, FieldValue } from '../field/types';
import type { FormFieldSnapshot } from './shared';
export interface FormRootProps {
  disabled?: boolean;
  ariaLabel?: string;
}
export type FormValues = Record<string, FieldValue>;
export type FormRootExposes = {
  disabled: ExposeState<boolean>;
  pending: ExposeState<boolean>;
  submitted: ExposeState<boolean>;
  getValues: ExposeMethod<() => FormValues>;
  requestSubmit: ExposeMethod<() => boolean>;
  resetValidation: ExposeMethod<() => void>;
  requestReset: ExposeMethod<() => boolean>;
  cancelSubmit: ExposeMethod<() => void>;
  __fieldChanged: ExposeMethod<() => void>;
  submit: ExposeEvent<{ values: FormValues; submissionId: number }>;
  invalid: ExposeEvent<{ names: string[] }>;
  reset: ExposeEvent<{}>;
};
export type FormRootAsHookContract = {
  state: { disabled: State<boolean>; pending: State<boolean>; submitted: State<boolean> };
};
export interface FormFieldProps extends FieldRootProps {
  name?: string;
}
export type FormFieldExposes = FieldRootExposes & {
  __formField: ExposeMethod<() => FormFieldSnapshot>;
  __formReset: ExposeMethod<() => boolean>;
};
export interface FormActionProps {
  disabled?: boolean;
}

export type FormActionStates = {
  disabled: State<boolean>;
  hovered: State<boolean>;
  pressed: State<boolean>;
  focused: State<boolean>;
  focusVisible: State<boolean>;
};
export type FormActionExposes = {
  disabled: ExposeState<boolean>;
  hovered: ExposeState<boolean>;
  pressed: ExposeState<boolean>;
  focused: ExposeState<boolean>;
  focusVisible: ExposeState<boolean>;
  focusSelf: ExposeMethod<(options?: FocusRequestOptions) => void>;
};
export type FormActionAsHookContract = { state: FormActionStates };
