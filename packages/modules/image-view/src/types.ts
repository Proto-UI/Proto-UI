import type { ModuleInstance, ModulePort } from '@proto.ui/core';
import type { ImageViewPatch, ImageViewSnapshot, ImageViewHandle, ImageViewStatus, ImageViewStatusChange } from '@proto.ui/core';

export type ImageViewFacade = {
  declare<P = unknown>(): ImageViewHandle<P>;
};

export type ImageViewPort = ModulePort & {
  isDeclared(): boolean;
  getSnapshot(): ImageViewSnapshot | null;
};

export type ImageViewModule = ModuleInstance<ImageViewFacade> & {
  name: 'image-view';
  scope: 'instance';
  port: ImageViewPort;
};
