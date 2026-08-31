import type {
  ImageViewHandle,
  ImageViewSnapshot,
  ModuleInstance,
  ModulePort,
} from '@proto.ui/core';
import type { PropsBaseType } from '@proto.ui/types';

export type ImageViewFacade = {
  declare<P extends PropsBaseType = PropsBaseType>(): ImageViewHandle<P>;
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
