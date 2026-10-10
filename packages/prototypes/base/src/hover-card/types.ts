import type {
  BorrowedStateHandle,
  ExposeEvent,
  ExposeMethod,
  ExposeState,
  State,
} from '@proto.ui/core';
import type { TransitionExposes, TransitionHandles, TransitionProps } from '../transition/types';

export interface HoverCardRootProps {
  // P-BASE-HOVER-CARD-PROPS
  open?: boolean;
  defaultOpen?: boolean;
  disabled?: boolean;
  openDelay?: number;
  closeDelay?: number;
}

/** P-BASE-HOVER-CARD-INTERACTION-RELEASE: additive draft cooperation surface. */
export type HoverCardInteractionPart = 'trigger' | 'content';
export type HoverCardReleaseInteraction = (
  part: HoverCardInteractionPart,
  contributionId: number
) => boolean;

export type HoverCardRootExposes = {
  // P-BASE-HOVER-CARD-INTERACTION-RELEASE: owner-bound transient withdrawal only.
  releaseInteraction: ExposeMethod<HoverCardReleaseInteraction>;
  // P-BASE-HOVER-CARD-OPEN-EXPOSE
  open: ExposeState<boolean>;
  openHoverCard: ExposeMethod<(reason?: string) => void>;
  close: ExposeMethod<(reason?: string) => void>;
  toggle: ExposeMethod<(reason?: string) => void>;
  // P-BASE-HOVER-CARD-OPEN-CHANGE
  openChange: ExposeEvent<{ open: boolean; reason: string | null }>;
};

export type HoverCardRootStateHandles = {
  open: State<boolean>;
};

export type HoverCardRootAsHookContract = {
  state: HoverCardRootStateHandles;
};

export interface HoverCardTriggerProps {
  // P-BASE-HOVER-CARD-TRIGGER-DISABLED
  disabled?: boolean;
}

export type HoverCardTriggerExposes = {
  // P-BASE-HOVER-CARD-TRIGGER-INTERACTION
  disabled: ExposeState<boolean>;
  hovered: ExposeState<boolean>;
  focused: ExposeState<boolean>;
  focusVisible: ExposeState<boolean>;
  focusSelf: ExposeMethod<(options?: { reason?: 'programmatic' | 'keyboard' | 'pointer' }) => void>;
};

export type HoverCardTriggerStateHandles = {
  disabled: State<boolean>;
  hovered: State<boolean>;
  focused: State<boolean>;
  focusVisible: State<boolean>;
};

export type HoverCardTriggerAsHookContract = {
  state: HoverCardTriggerStateHandles;
};

export type HoverCardSide = 'top' | 'right' | 'bottom' | 'left';
export type HoverCardAlign = 'start' | 'center' | 'end';

export type HoverCardContentProps = TransitionProps & {
  // P-BASE-HOVER-CARD-CONTENT-POSITION
  side?: HoverCardSide;
  align?: HoverCardAlign;
  sideOffset?: number;
  alignOffset?: number;
  avoidCollisions?: boolean;
  collisionPadding?: number;
};

export type HoverCardContentExposes = TransitionExposes & {
  // P-BASE-HOVER-CARD-CONTENT-PRESENCE
  open: ExposeState<boolean>;
};

export type HoverCardContentStateHandles = {
  open: State<boolean>;
};

export type HoverCardContentAsHookContract = {
  state: HoverCardContentStateHandles;
  asHooks: {
    asTransition: TransitionHandles;
  };
};

export type HoverCardContentHandles = {
  stateHandles: {
    open: BorrowedStateHandle<boolean, HoverCardContentProps>;
  };
  asTransition: TransitionHandles;
};
