import type {
  ExposeEvent,
  ExposeState,
  ImageViewA11yMode,
  ImageViewFit,
  ImageViewStatus,
  ImageViewStatusChange,
  State,
} from '@proto.ui/core';

export interface ImageRootProps {
  source?: string;
  a11yMode?: ImageViewA11yMode;
  alternativeText?: string;
  fit?: ImageViewFit;
}

export type ImageRootExposes = {
  source: ExposeState<string>;
  loadingStatus: ExposeState<ImageViewStatus>;
  fit: ExposeState<ImageViewFit>;
  loadingStatusChange: ExposeEvent<ImageViewStatusChange>;
};

export type ImageRootStateHandles = {
  source: State<string>;
  loadingStatus: State<ImageViewStatus>;
  fit: State<ImageViewFit>;
};
