import type {
  ExposeEvent,
  ExposeMethod,
  ExposeState,
  ObservedStateHandle,
  State,
} from '@proto.ui/core';

/** A row proposes an opaque identity; its consumer owns accepted selection. */
export interface SelectableRowProps {
  itemKey?: string;
  selected?: boolean;
  disabled?: boolean;
  activatable?: boolean;
}

export type SelectableRowExposes = {
  selected: ExposeState<boolean>;
  disabled: ExposeState<boolean>;
  focused: ExposeState<boolean>;
  focusVisible: ExposeState<boolean>;
  focusSelf: ExposeMethod<() => void>;
  selectionChange: ExposeEvent<{ value: string }>;
  activate: ExposeEvent<{ value: string }>;
};

export type SelectableRowAsHookContract = {
  state: {
    selected: State<boolean>;
    disabled: State<boolean>;
    focused: ObservedStateHandle<boolean, SelectableRowProps>;
    focusVisible: ObservedStateHandle<boolean, SelectableRowProps>;
  };
};
