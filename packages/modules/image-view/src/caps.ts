import { cap } from '@proto.ui/core';
import type { ImageViewPatch } from '@proto.ui/core';

export type ImageViewGeneration = number;

export type ImageViewHostUpdate = Readonly<{
  generation: ImageViewGeneration;
  patch: ImageViewPatch;
}>;

export type ImageViewHostCompletion = Readonly<{
  generation: ImageViewGeneration;
  status: 'loaded' | 'error';
}>;

export type ImageViewHostConnection = Readonly<{
  generation: ImageViewGeneration;
  patch: ImageViewPatch;
  onStatusChange(change: ImageViewHostCompletion): void;
}>;

export type ImageViewHostLease = Readonly<{
  update(update: ImageViewHostUpdate): void;
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
