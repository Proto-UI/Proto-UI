import type { ObservedStateHandle } from '@proto.ui/core';
import { ExposeEvent, ExposeMethod, ExposeState, FocusRequestOptions, State } from '@proto.ui/core';

/** Explicit accessible naming uses the `a11yLabel` prop; Adapter InstanceAssociations.controlLabel remains independent. */
export interface ButtonProps {
  // P-BASE-BUTTON-PROP-DISABLED
  disabled?: boolean;
  // P-BASE-BUTTON-PROP-A11Y-LABEL
  a11yLabel?: string;
  // P-BASE-BUTTON-PROP-NO-EVENT-CALLBACK: click is exposed as a signal, not accepted as props.
}

export type ButtonExposes = {
  // P-BASE-BUTTON-DISABLED-EXPOSE
  disabled: ExposeState<boolean>;
  // P-BASE-BUTTON-POINTER-HOVER
  hovered: ExposeState<boolean>;
  // P-BASE-BUTTON-FOCUSABLE
  focused: ExposeState<boolean>;
  focusVisible: ExposeState<boolean>;
  // P-BASE-BUTTON-PRESS-LIFECYCLE
  pressed: ExposeState<boolean>;
  // P-BASE-BUTTON-REQUEST-FOCUS
  focusSelf: ExposeMethod<(options?: FocusRequestOptions) => void>;
  // P-BASE-BUTTON-CLICK-SIGNAL, P-BASE-BUTTON-CLICK-PROTOCOL-NAME
  click: ExposeEvent<void>;
};

export type ButtonStateHandles = {
  disabled: State<boolean>;
  hovered: State<boolean>;
  focused: ObservedStateHandle<boolean, ButtonProps>;
  focusVisible: ObservedStateHandle<boolean, ButtonProps>;
  pressed: State<boolean>;
};

export type ButtonAsHookContract = {
  state: ButtonStateHandles;
  event: {
    click: void;
  };
};
