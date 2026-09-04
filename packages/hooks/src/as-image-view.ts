import type { ImageViewHandle } from '@proto.ui/core';
import type { PropsBaseType } from '@proto.ui/types';
import { definePrivilegedAsHook } from './privileged';

type ImageViewFacade = {
  declare<P extends PropsBaseType = PropsBaseType>(): ImageViewHandle<P>;
};

export function asImageView<P extends PropsBaseType = PropsBaseType>(): ImageViewHandle<P> {
  return getImageView() as ImageViewHandle<P>;
}

const getImageView = definePrivilegedAsHook<PropsBaseType, ImageViewHandle<PropsBaseType>>({
  name: 'asImageView',
  setup: ({ facades }) => {
    const facade = facades['image-view'] as ImageViewFacade | undefined;
    if (!facade || typeof facade.declare !== 'function') {
      throw new Error('[AsHook] image-view facade unavailable for asImageView.');
    }
    return facade.declare();
  },
});
