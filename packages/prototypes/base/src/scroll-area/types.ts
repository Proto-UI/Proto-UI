import { ExposeState, State } from '@proto.ui/core';

export interface ScrollAreaRootProps {}

export type ScrollAreaRootExposes = {};

export type ScrollAreaRootStateHandles = {};

export type ScrollAreaRootAsHookContract = {};

export interface ScrollAreaViewportProps {}

export type ScrollAreaViewportExposes = {
  focused: ExposeState<boolean>;
  focusVisible: ExposeState<boolean>;
  scrollAxes: ExposeState<string>;
  scrolling: ExposeState<boolean>;
  scrollProjection: ExposeState<string>;
  scrollXPosition: ExposeState<number>;
  scrollXVisibleRatio: ExposeState<number>;
  canScrollLeft: ExposeState<boolean>;
  canScrollRight: ExposeState<boolean>;
  scrollYPosition: ExposeState<number>;
  scrollYVisibleRatio: ExposeState<number>;
  canScrollUp: ExposeState<boolean>;
  canScrollDown: ExposeState<boolean>;
};

export type ScrollAreaViewportStateHandles = {
  focused: State<boolean>;
  focusVisible: State<boolean>;
};

/** Styled projections read the focus facts of the surface; they install none. */
export type ScrollAreaViewportAsHookContract = {
  state: ScrollAreaViewportStateHandles;
};

export interface ScrollAreaScrollbarProps {
  orientation?: 'horizontal' | 'vertical';
}

export type ScrollAreaScrollbarExposes = {
  orientation: ExposeState<string>;
};

export type ScrollAreaScrollbarStateHandles = {
  orientation: State<string>;
};

export type ScrollAreaScrollbarAsHookContract = {
  state: ScrollAreaScrollbarStateHandles;
};

export interface ScrollAreaThumbProps {}

export type ScrollAreaThumbExposes = {};

export type ScrollAreaThumbStateHandles = {};

export type ScrollAreaThumbAsHookContract = {};
