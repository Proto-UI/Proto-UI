import type {
  ExposeEvent,
  ExposeMethod,
  ExposeState,
  FocusRequestOptions,
  State,
} from '@proto.ui/core';

export interface TextareaRootProps {
  value?: string;
  defaultValue?: string;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  rows?: number;
  required?: boolean;
  name?: string;
  autoComplete?: string;
  minLength?: number;
  maxLength?: number;
  wrap?: 'soft' | 'hard';
  ariaLabel?: string;
  labelledBy?: string;
  describedBy?: string;
}

export type TextareaValueChangeDetail = Readonly<{
  value: string;
  composing: boolean;
  data: string | null;
  inputType: string | null;
}>;

export type TextareaChangeDetail = Readonly<{
  value: string;
}>;

export type TextareaCompositionDetail = Readonly<{
  value: string;
  data: string | null;
}>;

export type TextareaRootExposes = {
  value: ExposeState<string>;
  disabled: ExposeState<boolean>;
  readOnly: ExposeState<boolean>;
  focused: ExposeState<boolean>;
  focusVisible: ExposeState<boolean>;
  composing: ExposeState<boolean>;
  focusSelf: ExposeMethod<(options?: FocusRequestOptions) => void>;
  blurSelf: ExposeMethod<() => void>;
  valueChange: ExposeEvent<TextareaValueChangeDetail>;
  change: ExposeEvent<TextareaChangeDetail>;
  compositionStart: ExposeEvent<TextareaCompositionDetail>;
  compositionUpdate: ExposeEvent<TextareaCompositionDetail>;
  compositionEnd: ExposeEvent<TextareaCompositionDetail>;
};

export type TextareaRootStateHandles = {
  value: State<string>;
  disabled: State<boolean>;
  readOnly: State<boolean>;
  focused: State<boolean>;
  focusVisible: State<boolean>;
  composing: State<boolean>;
};

export type TextareaRootAsHookContract = {
  state: TextareaRootStateHandles;
  event: {
    valueChange: TextareaValueChangeDetail;
    change: TextareaChangeDetail;
    compositionStart: TextareaCompositionDetail;
    compositionUpdate: TextareaCompositionDetail;
    compositionEnd: TextareaCompositionDetail;
  };
};
