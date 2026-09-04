import type {
  ExposeEvent,
  ExposeMethod,
  ExposeState,
  FocusRequestOptions,
  State,
} from '@proto.ui/core';

export interface InputRootProps {
  value?: string;
  defaultValue?: string;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  required?: boolean;
  name?: string;
  autoComplete?: string;
  minLength?: number;
  maxLength?: number;
  inputMode?: 'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search';
  enterKeyHint?: 'enter' | 'done' | 'go' | 'next' | 'previous' | 'search' | 'send';
  ariaLabel?: string;
  labelledBy?: string;
  describedBy?: string;
}

export type InputValueChangeDetail = Readonly<{
  value: string;
  composing: boolean;
  data: string | null;
  inputType: string | null;
}>;

export type InputChangeDetail = Readonly<{ value: string }>;

export type InputCompositionDetail = Readonly<{
  value: string;
  data: string | null;
}>;

export type InputRootExposes = {
  value: ExposeState<string>;
  disabled: ExposeState<boolean>;
  readOnly: ExposeState<boolean>;
  focused: ExposeState<boolean>;
  focusVisible: ExposeState<boolean>;
  composing: ExposeState<boolean>;
  focusSelf: ExposeMethod<(options?: FocusRequestOptions) => void>;
  blurSelf: ExposeMethod<() => void>;
  valueChange: ExposeEvent<InputValueChangeDetail>;
  change: ExposeEvent<InputChangeDetail>;
  compositionStart: ExposeEvent<InputCompositionDetail>;
  compositionUpdate: ExposeEvent<InputCompositionDetail>;
  compositionEnd: ExposeEvent<InputCompositionDetail>;
};

export type InputRootStateHandles = {
  value: State<string>;
  disabled: State<boolean>;
  readOnly: State<boolean>;
  focused: State<boolean>;
  focusVisible: State<boolean>;
  composing: State<boolean>;
};

export type InputRootAsHookContract = {
  state: InputRootStateHandles;
  event: {
    valueChange: InputValueChangeDetail;
    change: InputChangeDetail;
    compositionStart: InputCompositionDetail;
    compositionUpdate: InputCompositionDetail;
    compositionEnd: InputCompositionDetail;
  };
};
