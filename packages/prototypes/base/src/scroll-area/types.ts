import { ExposeState, State } from '@proto.ui/core';

export interface ScrollAreaRootProps {}

export type ScrollAreaRootExposes = {};

export type ScrollAreaRootStateHandles = {};

export type ScrollAreaRootAsHookContract = {};

export interface ScrollAreaViewportProps {}

export type ScrollAreaViewportExposes = {
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

export type ScrollAreaViewportStateHandles = {};

export type ScrollAreaViewportAsHookContract = {};

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
