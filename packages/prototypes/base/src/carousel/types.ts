import type {
  ObservedStateHandle,
  CollectionExposes,
  CollectionItemExposes,
  ExposeState,
  ExposeMethod,
  ExposeEvent,
  State,
} from '@proto.ui/core';
export type { CarouselRootProps, CarouselSlideProps } from './index';
export type CarouselViewportProps = Record<string, never>;
export type CarouselRootExposes = CollectionExposes & {
  index: ExposeState<number>;
  slideCount: ExposeState<number>;
  visibleSlides: ExposeState<number>;
  maxIndex: ExposeState<number>;
  requestIndex: ExposeMethod<(next: number) => boolean>;
  indexChange: ExposeEvent<{ index: number }>;
};
export type CarouselViewportExposes = {
  focusVisible: ExposeState<boolean>;
  dragging: ExposeState<boolean>;
  scrolling: ExposeState<boolean>;
  scrollPosition: ExposeState<number>;
};
export type CarouselSlideExposes = CollectionItemExposes & {
  current: ExposeState<boolean>;
  hidden: ExposeState<boolean>;
  basis: ExposeState<number>;
  minSize: ExposeState<number>;
};
export type CarouselPreviousProps = import('../button').ButtonProps;
export type CarouselPreviousExposes = import('../button').ButtonExposes;
export type CarouselNextProps = CarouselPreviousProps;
export type CarouselNextExposes = CarouselPreviousExposes;
export type CarouselRootAsHookContract = {
  state: {
    collectionCount: State<number>;
    index: State<number>;
    count: State<number>;
    a11yLabel: State<string>;
    visibleSlides: State<number>;
    maxIndex: State<number>;
  };
};
export type CarouselViewportAsHookContract = {
  state: {
    '@scroll/scrolling': ObservedStateHandle<boolean, CarouselViewportProps>;
    focusVisible: ObservedStateHandle<boolean, CarouselViewportProps>;
    dragging: State<boolean>;
    orientation: State<string>;
    direction: State<string>;
    scrollPosition: State<number>;
  };
};
export type CarouselSlideAsHookContract = {
  state: {
    collectionIndex: State<number>;
    collectionTotal: State<number>;
    collectionFirst: State<boolean>;
    collectionLast: State<boolean>;
    current: State<boolean>;
    hidden: State<boolean>;
    label: State<string>;
    basis: State<number>;
    minSize: State<number>;
  };
};
export type CarouselNavigationAsHookContract = {
  asHooks: { 'as-button': ReturnType<typeof import('../button').asButton> };
};
