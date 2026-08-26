import { cap } from '@proto.ui/core';
import type { ImageViewPatch, ImageViewStatusChange } from '@proto.ui/core';

export type ImageViewHostConnection = Readonly<{
  patch: ImageViewPatch;
  onStatusChange(change: ImageViewStatusChange): void;
}>;

export type ImageViewHostLease = Readonly<{
  update(patch: ImageViewPatch): void;
  snapshot(): import('@proto.ui/core').ImageViewSnapshot;
  dispose(): void;
}>;

export type ImageViewHost = Readonly<{
  attach(connection: ImageViewHostConnection): ImageViewHostLease;
}>;

export const IMAGE_VIEW_HOST_CAP = cap<ImageViewHost>('@proto.ui/image-view/host');
export const IMAGE_VIEW_RUN_IN_CALLBACK_CAP = cap<(callback: () => void) => void>(
  '@proto.ui/image-view/run-in-callback'
);
