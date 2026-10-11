import type { ContextKey, JsonObject } from '@proto.ui/types';
import type {
  BorrowedStateHandle,
  ExposeEvent,
  ExposeMethod,
  ExposeState,
  ExposeValue,
  State,
} from '@proto.ui/core';

export type TransitionState = 'closed' | 'entering' | 'entered' | 'leaving';
export type TransitionInterrupt = 'reverse' | 'wait' | 'immediate';

export type TransitionProps = {
  open?: boolean;
  defaultOpen?: boolean;
  appear?: boolean;
  enterDuration?: number;
  leaveDuration?: number;
  interrupt?: TransitionInterrupt;
};

/** Setup-only initial fallback; no selector callback or ongoing context subscription. */
export type TransitionInitialOpenSource<T extends JsonObject> = Readonly<{
  context: ContextKey<T>;
  field: { [K in keyof T]-?: T[K] extends boolean ? K : never }[keyof T] & string;
}>;

export type TransitionInitialOpenBinding = <T extends JsonObject>(
  source: TransitionInitialOpenSource<T>
) => void;

export type TransitionControls = {
  enter(): void;
  leave(): void;
  complete(): void;
};

export type TransitionConfig = {
  appear?: boolean;
  enterDuration?: number;
  leaveDuration?: number;
  interrupt?: TransitionInterrupt;
};

export type TransitionExposes = {
  /** Authored capture/projection entry; always setup-only, never a runtime command. */
  bindInitialOpen: ExposeMethod<TransitionInitialOpenBinding>;
  beforeEnter: ExposeEvent<void>;
  afterEnter: ExposeEvent<void>;
  beforeLeave: ExposeEvent<void>;
  afterLeave: ExposeEvent<void>;
  transitionState: ExposeState<TransitionState>;
  /** Perceptual presence. Structural view presence remains owned by lifecycle ViewIntent. */
  isPresent: ExposeState<boolean>;
  enter: ExposeMethod<() => void>;
  leave: ExposeMethod<() => void>;
  complete: ExposeMethod<() => void>;
  controls: ExposeValue<TransitionControls>;
};

export type TransitionHandles = {
  transitionState: BorrowedStateHandle<TransitionState, TransitionProps>;
  /** Perceptual presence. This must not be used as a second mount-phase fact. */
  isPresent: BorrowedStateHandle<boolean, TransitionProps>;
  controls: TransitionControls;
  /** Sets setup-time defaults. Explicit host props take precedence at runtime. */
  configure(config: TransitionConfig): void;
  /** Samples a boolean context field once at created only without explicit own open/defaultOpen. */
  bindInitialOpen: TransitionInitialOpenBinding;
};

export type TransitionAsHookContract = {
  state: {
    transitionState: State<TransitionState>;
    isPresent: State<boolean>;
    transitionAppearDefault: State<boolean>;
    transitionEnterDurationDefault: State<number>;
    transitionLeaveDurationDefault: State<number>;
    transitionInterruptDefault: State<TransitionInterrupt>;
  };
};
