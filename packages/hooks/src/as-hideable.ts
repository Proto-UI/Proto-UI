import type { HideableHandle } from '@proto.ui/core';
import type { PropsBaseType } from '@proto.ui/types';
import { definePrivilegedAsHook } from './privileged';

type VisibilityFacade = {
  getHideable<P extends PropsBaseType = PropsBaseType>(): HideableHandle<P>;
};

const getHideable = definePrivilegedAsHook<PropsBaseType, HideableHandle<PropsBaseType>>({
  name: 'asHideable',
  setup: ({ facades }) => {
    const facade = facades.visibility as VisibilityFacade | undefined;
    if (!facade || typeof facade.getHideable !== 'function') {
      throw new Error(`[AsHook] visibility facade unavailable for asHideable.`);
    }
    return facade.getHideable();
  },
});

export function asHideable<P extends PropsBaseType = PropsBaseType>(): HideableHandle<P> {
  return getHideable() as HideableHandle<P>;
}
