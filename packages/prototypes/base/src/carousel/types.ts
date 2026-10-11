import type {
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
  requestIndex: ExposeMethod<(next: number) => boolean>;
  indexChange: ExposeEvent<{ index: number }>;
};
export type CarouselViewportExposes = { focusVisible: ExposeState<boolean> };
export type CarouselSlideExposes = CollectionItemExposes & {
  current: ExposeState<boolean>;
  hidden: ExposeState<boolean>;
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
  };
};
export type CarouselViewportAsHookContract = { state: { focusVisible: State<boolean> } };
export type CarouselSlideAsHookContract = {
  state: {
    collectionIndex: State<number>;
    collectionTotal: State<number>;
    collectionFirst: State<boolean>;
    collectionLast: State<boolean>;
    current: State<boolean>;
    hidden: State<boolean>;
    label: State<string>;
  };
};
export type CarouselNavigationAsHookContract = {
  asHooks: { 'as-button': ReturnType<typeof import('../button').asButton> };
};
