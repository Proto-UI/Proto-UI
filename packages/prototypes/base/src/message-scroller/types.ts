import type {
  ExposeMethod,
  ObservedStateHandle,
  ExposeState,
  ScrollEndFollowState,
  ScrollEndFollowRequestStatus,
  ScrollSurfaceRequestOutcome,
  State,
} from '@proto.ui/core';
import type { asButton, ButtonExposes, ButtonProps } from '../button';
import type {
  asScrollAreaRoot,
  asScrollAreaViewport,
  ScrollAreaRootExposes,
  ScrollAreaViewportExposes,
} from '../scroll-area';
export interface MessageScrollerRootProps {
  newContentCount?: number;
  a11yLabel?: string;
}
export type MessageScrollerViewportProps = Record<string, never>;
export type MessageScrollerJumpProps = ButtonProps;
export type MessageScrollerRootExposes = ScrollAreaRootExposes;
export type MessageScrollerViewportExposes = ScrollAreaViewportExposes & {
  atEnd: ExposeState<boolean>;
  following: ExposeState<ScrollEndFollowState>;
  requestStatus: ExposeState<ScrollEndFollowRequestStatus>;
  jumpToEnd: ExposeMethod<() => void>;
  pauseFollowing: ExposeMethod<() => ScrollSurfaceRequestOutcome>;
};
export type MessageScrollerJumpExposes = ButtonExposes & {
  atEnd: ExposeState<boolean>;
  newContentCount: ExposeState<number>;
};
export type MessageScrollerRootAsHookContract = {
  asHooks: { 'as-scroll-area-root': ReturnType<typeof asScrollAreaRoot> };
};
export type MessageScrollerViewportAsHookContract = {
  state: {
    a11yLabel: State<string>;
    '@scroll/verticalAtEnd': ObservedStateHandle<boolean, MessageScrollerViewportProps>;
    '@scroll/endFollowState': ObservedStateHandle<
      ScrollEndFollowState,
      MessageScrollerViewportProps
    >;
    '@scroll/endFollowRequestStatus': ObservedStateHandle<
      ScrollEndFollowRequestStatus,
      MessageScrollerViewportProps
    >;
  };
  asHooks: { 'as-scroll-area-viewport': ReturnType<typeof asScrollAreaViewport> };
};
export type MessageScrollerJumpAsHookContract = {
  state: { atEnd: State<boolean>; newContentCount: State<number> };
  asHooks: { 'as-button': ReturnType<typeof asButton> };
};
