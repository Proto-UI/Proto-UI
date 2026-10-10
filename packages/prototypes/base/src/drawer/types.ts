import type {
  BorrowedStateHandle,
  ExposeEvent,
  ExposeMethod,
  ExposeState,
  State,
} from '@proto.ui/core';
import type { DrawerOpenFocusReason } from './shared';
import type { TransitionExposes, TransitionHandles, TransitionProps } from '../transition/types';

export interface DrawerRootProps {
  open?: boolean;
  defaultOpen?: boolean;
  disabled?: boolean;
  a11yLabel?: string;
}

export type DrawerRootExposes = {
  open: ExposeState<boolean>;
  openDrawer: ExposeMethod<(reason?: string) => void>;
  close: ExposeMethod<(reason?: string) => void>;
  toggle: ExposeMethod<(reason?: string) => void>;

  openChange: ExposeEvent<{
    open: boolean;
    reason: string | null;
    focusReason: DrawerOpenFocusReason | null;
  }>;
};

export type DrawerRootStateHandles = {
  open: State<boolean>;
};

export type DrawerRootAsHookContract = {
  state: DrawerRootStateHandles;
};

export interface DrawerTriggerProps {
  disabled?: boolean;
}

export type DrawerTriggerExposes = {
  disabled: ExposeState<boolean>;
  hovered: ExposeState<boolean>;
  focused: ExposeState<boolean>;
  focusVisible: ExposeState<boolean>;
  pressed: ExposeState<boolean>;
  focusSelf: ExposeMethod<(options?: { reason?: 'programmatic' | 'keyboard' | 'pointer' }) => void>;
};

export type DrawerTriggerAsHookContract = {
  state: DrawerCommandStateHandles;
};

export type DrawerCommandStateHandles = {
  disabled: State<boolean>;
  hovered: State<boolean>;
  focused: State<boolean>;
  focusVisible: State<boolean>;
  pressed: State<boolean>;
};

export type DrawerMaskProps = TransitionProps & {
  passthrough?: boolean;
};

export type DrawerMaskExposes = TransitionExposes;

export type DrawerMaskStateHandles = {
  open: State<boolean>;
};

export type DrawerMaskAsHookContract = {
  state: DrawerMaskStateHandles;
  asHooks: {
    asTransition: TransitionHandles;
  };
};

export type DrawerMaskHandles = {
  stateHandles: {
    open: BorrowedStateHandle<boolean, DrawerMaskProps>;
  };
  asTransition: TransitionHandles;
};

export type DrawerContentProps = TransitionProps & {
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** Fractions of the full panel; invalid entries are ignored. Defaults to [1]. */
  snapPoints?: number[];
  snapPoint?: number;
  defaultSnapPoint?: number;
  dragDismissible?: boolean;
  /** Visible fraction below which a completed drag requests close. Default 0.25. */
  dragDismissThreshold?: number;
};

export type DrawerContentExposes = TransitionExposes & {
  open: ExposeState<boolean>;
  snapPoint: ExposeState<number>;
  dragging: ExposeState<boolean>;
  dragProgress: ExposeState<number>;
  offsetPercentage: ExposeState<number>;
  requestSnapPoint: ExposeMethod<(value: number, reason?: string) => void>;
  snapPointChange: ExposeEvent<{ snapPoint: number; reason: string }>;
  __onAxisInput: ExposeMethod<(sample: import('@proto.ui/core').AxisInputSample) => void>;
};

export type DrawerContentStateHandles = {
  open: State<boolean>;
  snapPoint: State<number>;
  dragging: State<boolean>;
  dragProgress: State<number>;
  offsetPercentage: State<number>;
};

export type DrawerContentAsHookContract = {
  state: DrawerContentStateHandles;
  asHooks: {
    asTransition: TransitionHandles;
  };
};

export type DrawerContentHandles = {
  stateHandles: {
    open: BorrowedStateHandle<boolean, DrawerContentProps>;
    snapPoint: BorrowedStateHandle<number, DrawerContentProps>;
    dragging: BorrowedStateHandle<boolean, DrawerContentProps>;
    dragProgress: BorrowedStateHandle<number, DrawerContentProps>;
    offsetPercentage: BorrowedStateHandle<number, DrawerContentProps>;
  };
  asTransition: TransitionHandles;
};

export interface DrawerTitleProps {}

export type DrawerTitleExposes = {};

export type DrawerTitleAsHookContract = {};

export interface DrawerDescriptionProps {}

export type DrawerDescriptionExposes = {};

export type DrawerDescriptionAsHookContract = {};

export interface DrawerCloseProps {
  disabled?: boolean;
}

export type DrawerCloseExposes = {
  disabled: ExposeState<boolean>;
  hovered: ExposeState<boolean>;
  focused: ExposeState<boolean>;
  focusVisible: ExposeState<boolean>;
  pressed: ExposeState<boolean>;
  focusSelf: ExposeMethod<(options?: { reason?: 'programmatic' | 'keyboard' | 'pointer' }) => void>;
};

export type DrawerCloseAsHookContract = {
  state: DrawerCommandStateHandles;
};

export interface DrawerHandleProps {
  disabled?: boolean;
  a11yLabel?: string;
}
export type DrawerHandleExposes = {
  disabled: ExposeState<boolean>;
  focused: ExposeState<boolean>;
  focusVisible: ExposeState<boolean>;
  focusSelf: ExposeMethod<(options?: { reason?: 'programmatic' | 'keyboard' | 'pointer' }) => void>;
};
export type DrawerHandleAsHookContract = {
  state: {
    disabled: State<boolean>;
    focused: State<boolean>;
    focusVisible: State<boolean>;
  };
};
