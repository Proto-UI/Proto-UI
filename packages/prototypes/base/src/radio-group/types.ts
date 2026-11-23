import type {
  ObservedStateHandle,
  CollectionItemSnapshot,
  ExposeEvent,
  ExposeMethod,
  ExposeState,
  FocusRequestOptions,
  State,
} from '@proto.ui/core';

export interface RadioGroupRootProps {
  value?: string;
  defaultValue?: string;
  disabled?: boolean;
  readOnly?: boolean;
  a11yLabel?: string;
}

export type RadioGroupValueChangeDetail = Readonly<{ value: string }>;

export type RadioGroupRootExposes = {
  value: ExposeState<string>;
  disabled: ExposeState<boolean>;
  readOnly: ExposeState<boolean>;
  focused: ExposeState<boolean>;
  resetValue: ExposeMethod<() => boolean>;
  focusSelf: ExposeMethod<() => void>;
  count: ExposeState<number>;
  valueChange: ExposeEvent<RadioGroupValueChangeDetail>;
  requestValue: ExposeMethod<(value: string) => boolean>;
  focusFirst: ExposeMethod<() => void>;
  focusLast: ExposeMethod<() => void>;
  focusNext: ExposeMethod<() => void>;
  focusPrev: ExposeMethod<() => void>;
  focusSelected: ExposeMethod<() => void>;
  getCollectionItems: ExposeMethod<() => readonly CollectionItemSnapshot[]>;
  getCollectionCount: ExposeMethod<() => number>;
};

export type RadioGroupRootStateHandles = {
  value: State<string>;
  disabled: State<boolean>;
  readOnly: State<boolean>;
  focused: State<boolean>;
  count: State<number>;
};

export type RadioGroupRootAsHookContract = {
  state: RadioGroupRootStateHandles;
  event: { valueChange: RadioGroupValueChangeDetail };
};

export interface RadioGroupItemProps {
  value: string;
  disabled?: boolean;
}

export type RadioGroupItemSelectDetail = Readonly<{ value: string }>;

export type RadioGroupItemExposes = {
  checked: ExposeState<boolean>;
  disabled: ExposeState<boolean>;
  hovered: ExposeState<boolean>;
  focused: ExposeState<boolean>;
  focusVisible: ExposeState<boolean>;
  pressed: ExposeState<boolean>;
  focusSelf: ExposeMethod<(options?: FocusRequestOptions) => void>;
  select: ExposeEvent<RadioGroupItemSelectDetail>;
};

export type RadioGroupItemStateHandles = {
  checked: State<boolean>;
  disabled: State<boolean>;
  hovered: State<boolean>;
  focused: ObservedStateHandle<boolean, RadioGroupItemProps>;
  focusVisible: ObservedStateHandle<boolean, RadioGroupItemProps>;
  pressed: State<boolean>;
};

export type RadioGroupItemAsHookContract = {
  state: RadioGroupItemStateHandles;
  event: { select: RadioGroupItemSelectDetail };
};

export interface RadioGroupIndicatorProps {}

export type RadioGroupIndicatorExposes = {
  checked: ExposeState<boolean>;
  disabled: ExposeState<boolean>;
  isChecked: ExposeMethod<() => boolean>;
};

export type RadioGroupIndicatorStateHandles = {
  checked: State<boolean>;
  disabled: State<boolean>;
};

export type RadioGroupIndicatorAsHookContract = {
  state: RadioGroupIndicatorStateHandles;
};
