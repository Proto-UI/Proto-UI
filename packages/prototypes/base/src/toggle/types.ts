import type { ObservedStateHandle } from '@proto.ui/core';
import { ExposeEvent, ExposeMethod, ExposeState, FocusRequestOptions, State } from '@proto.ui/core';

/** Explicit accessible naming uses the `a11yLabel` prop; Adapter InstanceAssociations.controlLabel remains independent. */
export interface ToggleProps {
  active?: boolean;
  defaultActive?: boolean;
  disabled?: boolean;
  // P-BASE-TOGGLE-PROP-A11Y-LABEL
  a11yLabel?: string;
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
