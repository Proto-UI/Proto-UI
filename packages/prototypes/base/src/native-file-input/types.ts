import type {
  ExposeMethod,
  ExposeState,
  FocusRequestOptions,
  ObservedStateHandle,
  State,
} from '@proto.ui/core';

/** Portable control policy; File objects and picker options stay host-local. */
export interface NativeFileInputProps {
  disabled?: boolean;
  required?: boolean;
  ariaLabel?: string;
}

export type NativeFileInputExposes = {
  disabled: ExposeState<boolean>;
  required: ExposeState<boolean>;
  focused: ExposeState<boolean>;
  focusVisible: ExposeState<boolean>;
  focusSelf: ExposeMethod<(options?: FocusRequestOptions) => void>;
  blurSelf: ExposeMethod<() => void>;
};

export type NativeFileInputAsHookContract = {
  state: {
    disabled: State<boolean>;
    required: State<boolean>;
    focused: ObservedStateHandle<boolean, NativeFileInputProps>;
    focusVisible: ObservedStateHandle<boolean, NativeFileInputProps>;
  };
};
