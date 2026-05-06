import { ExposeEvent, ExposeMethod, ExposeState, State } from '@proto.ui/core';

export interface RadioGroupRootProps {
  value?: string;
  defaultValue?: string;
  disabled?: boolean;
}

export type RadioGroupRootExposes = {
  value: ExposeState<string>;
  disabled: ExposeState<boolean>;
  valueChange: ExposeEvent<{ value: string }>;
};

export type RadioGroupRootStateHandles = {
  value: State<string>;
  disabled: State<boolean>;
};

export type RadioGroupRootAsHookContract = {
  state: RadioGroupRootStateHandles;
  event: { valueChange: { value: string } };
};

export interface RadioItemProps {
  value?: string;
  disabled?: boolean;
}

export type RadioItemExposes = {
  checked: ExposeState<boolean>;
  disabled: ExposeState<boolean>;
  hovered: ExposeState<boolean>;
  focused: ExposeState<boolean>;
  focusVisible: ExposeState<boolean>;
  pressed: ExposeState<boolean>;
  click: ExposeEvent<void>;
  focusSelf: ExposeMethod<() => void>;
};

export type RadioItemStateHandles = {
  checked: State<boolean>;
  disabled: State<boolean>;
  hovered: State<boolean>;
  focused: State<boolean>;
  focusVisible: State<boolean>;
  pressed: State<boolean>;
};

export type RadioItemAsHookContract = {
  state: RadioItemStateHandles;
  event: { click: void };
};
