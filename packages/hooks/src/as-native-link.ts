import type { NativeLinkHandle } from '@proto.ui/core';
import type { PropsBaseType } from '@proto.ui/types';
import { definePrivilegedAsHook } from './privileged';

type NativeLinkFacade = { declare<P extends PropsBaseType>(): NativeLinkHandle<P> };
export function asNativeLink<P extends PropsBaseType = PropsBaseType>(): NativeLinkHandle<P> {
  return getNativeLink() as NativeLinkHandle<P>;
}
const getNativeLink = definePrivilegedAsHook<PropsBaseType, NativeLinkHandle<PropsBaseType>>({
  name: 'asNativeLink',
  setup: ({ facades }) => {
    const facade = facades['native-link'] as NativeLinkFacade | undefined;
    if (!facade) throw new Error('[AsHook] native-link facade unavailable for asNativeLink.');
    return facade.declare();
  },
});
