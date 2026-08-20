import type { ScrollSurfaceHandle } from '@proto.ui/core';
import type { PropsBaseType } from '@proto.ui/types';
import { definePrivilegedAsHook } from './privileged';

type ScrollFacade = {
  getSurface<P extends PropsBaseType = PropsBaseType>(): ScrollSurfaceHandle<P>;
};

const getScrollSurface = definePrivilegedAsHook<PropsBaseType, ScrollSurfaceHandle<PropsBaseType>>({
  name: 'asScrollSurface',
  setup: ({ facades }) => {
    const facade = facades.scroll as ScrollFacade | undefined;
    if (!facade || typeof facade.getSurface !== 'function') {
      throw new Error('[AsHook] scroll facade unavailable for asScrollSurface.');
    }
    return facade.getSurface();
  },
});

export function asScrollSurface<P extends PropsBaseType = PropsBaseType>(): ScrollSurfaceHandle<P> {
  return getScrollSurface() as ScrollSurfaceHandle<P>;
}
