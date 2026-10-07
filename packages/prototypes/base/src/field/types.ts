import type {
  BorrowedStateHandle,
  ExposeEvent,
  ExposeMethod,
  ExposeState,
  FocusRequestOptions,
  State,
} from '@proto.ui/core';
/** Finite, portable control values. No callback, DOM object, or opaque ref is a Prop. */
export type FieldValue = string | number | boolean | string[] | null;
export type FieldValidationMode = 'onBlur' | 'onChange' | 'manual';
export type FieldValidationReason = 'blur' | 'change' | 'manual';
export type FieldValidityFlag = 'valueMissing' | 'tooShort' | 'tooLong' | 'customError';
export type FieldStatus = 'unvalidated' | 'valid' | 'invalid';
export interface FieldRootProps {
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  invalid?: boolean;
  errors?: string[];
  defaultInvalid?: boolean;
  defaultErrors?: string[];
  validationMode?: FieldValidationMode;
  /** Consumer receives a versioned request and resolves it through an expose method. */
  externalValidation?: boolean;
}
export type FieldValidationResult = { invalid: boolean; errors?: string[] };
export type FieldValidationRequest = {
  requestId: string;
  value: FieldValue;
  reason: FieldValidationReason;
};
export type FieldValiditySnapshot = {
  status: FieldStatus;
  invalid: boolean;
  pending: boolean;
  dirty: boolean;
  touched: boolean;
  filled: boolean;
  focused: boolean;
  flags: FieldValidityFlag[];
  errors: string[];
};
export type FieldRootExposes = {
  invalid: ExposeState<boolean>;
  pending: ExposeState<boolean>;
  dirty: ExposeState<boolean>;
  touched: ExposeState<boolean>;
  filled: ExposeState<boolean>;
  focused: ExposeState<boolean>;
  disabled: ExposeState<boolean>;
  readOnly: ExposeState<boolean>;
  required: ExposeState<boolean>;
  getValidity: ExposeMethod<() => FieldValiditySnapshot>;
  /** Internal anatomy notification, not a DOM event channel. */
  __fieldNotify: ExposeMethod<(reason: string) => void>;
  validate: ExposeMethod<(reason?: FieldValidationReason) => string | null>;
  resolveValidation: ExposeMethod<(requestId: string, result: FieldValidationResult) => boolean>;
  cancelValidation: ExposeMethod<() => void>;
  resetValidation: ExposeMethod<() => void>;
  focusControl: ExposeMethod<(options?: FocusRequestOptions) => boolean>;
  validationRequest: ExposeEvent<FieldValidationRequest>;
  validityChange: ExposeEvent<FieldValiditySnapshot>;
};
export type FieldRootAsHookContract = {
  state: {
    invalid: State<boolean>;
    pending: State<boolean>;
    dirty: State<boolean>;
    touched: State<boolean>;
    filled: State<boolean>;
    focused: State<boolean>;
    disabled: State<boolean>;
    readOnly: State<boolean>;
    required: State<boolean>;
  };
};
export interface FieldControlBindingProps {
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
}
export type FieldControlReport = {
  value: FieldValue;
  initialValue?: FieldValue;
  focused?: boolean;
  composing?: boolean;
  reason?: 'sync' | 'input' | 'change' | 'blur' | 'compositionend';
};
export type FieldControlBindingStates = {
  fieldDisabled: State<boolean>;
  fieldReadOnly: State<boolean>;
  fieldRequired: State<boolean>;
  invalid: State<boolean>;
  pending: State<boolean>;
};
export type FieldControlBindingHandles = {
  state: {
    [K in keyof FieldControlBindingStates]: BorrowedStateHandle<boolean, FieldControlBindingProps>;
  };
  report: (report: FieldControlReport) => boolean;
};
export interface FieldControlProps {
  value?: string;
  defaultValue?: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  placeholder?: string;
  name?: string;
  autoComplete?: string;
  inputMode?: 'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search';
  enterKeyHint?: 'enter' | 'done' | 'go' | 'next' | 'previous' | 'search' | 'send';
  ariaLabel?: string;
}
export type FieldControlValueChangeDetail = Readonly<{
  value: string;
  composing: boolean;
  data: string | null;
  inputType: string | null;
}>;
export type FieldControlChangeDetail = Readonly<{ value: string }>;
export type FieldControlCompositionDetail = Readonly<{ value: string; data: string | null }>;
export type FieldControlStates = {
  value: State<string>;
  disabled: State<boolean>;
  readOnly: State<boolean>;
  focused: State<boolean>;
  focusVisible: State<boolean>;
  composing: State<boolean>;
  invalid: State<boolean>;
  pending: State<boolean>;
  required: State<boolean>;
};
export type FieldControlExposes = {
  value: ExposeState<string>;
  disabled: ExposeState<boolean>;
  readOnly: ExposeState<boolean>;
  focused: ExposeState<boolean>;
  focusVisible: ExposeState<boolean>;
  composing: ExposeState<boolean>;
  invalid: ExposeState<boolean>;
  pending: ExposeState<boolean>;
  required: ExposeState<boolean>;
  focusSelf: ExposeMethod<(options?: FocusRequestOptions) => void>;
  blurSelf: ExposeMethod<() => void>;
  valueChange: ExposeEvent<FieldControlValueChangeDetail>;
  change: ExposeEvent<FieldControlChangeDetail>;
  compositionStart: ExposeEvent<FieldControlCompositionDetail>;
  compositionUpdate: ExposeEvent<FieldControlCompositionDetail>;
  compositionEnd: ExposeEvent<FieldControlCompositionDetail>;
};
export type FieldControlAsHookContract = { state: FieldControlStates };
export interface FieldLabelProps {
  activation?: boolean;
}
export type FieldLabelExposes = { disabled: ExposeState<boolean>; required: ExposeState<boolean> };
export type FieldLabelAsHookContract = {
  state: { disabled: State<boolean>; required: State<boolean> };
};
export interface FieldDescriptionProps {}
export type FieldDescriptionExposes = {};
export interface FieldErrorProps {
  message?: string;
  keepMounted?: boolean;
}
export type FieldErrorExposes = {
  invalid: ExposeState<boolean>;
  hidden: ExposeState<boolean>;
  message: ExposeState<string>;
};
export type FieldErrorAsHookContract = {
  state: { invalid: State<boolean>; hidden: State<boolean>; message: State<string> };
};
export interface FieldValidityProps {}
export type FieldValidityExposes = Pick<
  FieldRootExposes,
  'getValidity' | 'invalid' | 'pending' | 'dirty' | 'touched' | 'filled' | 'focused'
>;
export type FieldValidityAsHookContract = {
  state: Pick<
    FieldRootAsHookContract['state'],
    'invalid' | 'pending' | 'dirty' | 'touched' | 'filled' | 'focused'
  >;
};
