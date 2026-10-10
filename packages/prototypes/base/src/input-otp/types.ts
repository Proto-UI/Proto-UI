import type { ExposeEvent, ExposeMethod, ExposeState, State } from '@proto.ui/core';
export interface InputOtpRootProps {
  value?: string;
  defaultValue?: string;
  length?: number;
  pattern?: 'numeric' | 'alphanumeric';
  disabled?: boolean;
  readOnly?: boolean;
  name?: string;
  ariaLabel?: string;
}
export interface InputOtpInputProps {
  placeholder?: string;
}
export interface InputOtpSlotProps {
  index?: number;
}
export type InputOtpRootExposes = {
  value: ExposeState<string>;
  complete: ExposeState<boolean>;
  disabled: ExposeState<boolean>;
  readOnly: ExposeState<boolean>;
  focused: ExposeState<boolean>;
  requestValue: ExposeMethod<(value: string) => boolean>;
  clear: ExposeMethod<() => boolean>;
  focusInput: ExposeMethod<() => boolean>;
  __focus: ExposeMethod<(focused: boolean) => void>;
  valueChange: ExposeEvent<{ value: string }>;
  completed: ExposeEvent<{ value: string }>;
};
export type InputOtpRootAsHookContract = {
  state: {
    value: State<string>;
    complete: State<boolean>;
    disabled: State<boolean>;
    readOnly: State<boolean>;
    focused: State<boolean>;
  };
};
