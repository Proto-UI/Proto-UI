import type { ObservedStateHandle } from '@proto.ui/core';
import { ExposeEvent, ExposeMethod, ExposeState, FocusRequestOptions, State } from '@proto.ui/core';

/** Independent accessible naming uses Adapter InstanceAssociations.controlLabel, outside portable Props. */
export interface ToggleProps {
  active?: boolean;
  defaultActive?: boolean;
  disabled?: boolean;
}

export type ToggleExposes = {
  disabled: ExposeState<boolean>;
  hovered: ExposeState<boolean>;
  focused: ExposeState<boolean>;
  focusVisible: ExposeState<boolean>;
  pressed: ExposeState<boolean>;
  active: ExposeState<boolean>;
  focusSelf: ExposeMethod<(options?: FocusRequestOptions) => void>;
  activeChange: ExposeEvent<{ active: boolean }>;
};

export type ToggleStateHandles = {
  disabled: State<boolean>;
  hovered: State<boolean>;
  focused: ObservedStateHandle<boolean, ToggleProps>;
  focusVisible: ObservedStateHandle<boolean, ToggleProps>;
  pressed: State<boolean>;
  active: State<boolean>;
};

export type ToggleAsHookContract = {
  state: ToggleStateHandles;
  event: {
    activeChange: { active: boolean };
  };
};
