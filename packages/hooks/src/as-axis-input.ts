import type { AxisInputHandle } from '@proto.ui/core';
import type { PropsBaseType } from '@proto.ui/types';
import { definePrivilegedAsHook } from './privileged';

type AxisInputFacade = { declare(): AxisInputHandle<PropsBaseType> };
const getAxisInput = definePrivilegedAsHook<PropsBaseType, AxisInputHandle<PropsBaseType>>({
  name: 'asAxisInput',
  setup: ({ facades }) => {
    const facade = facades['axis-input'] as AxisInputFacade | undefined;
    if (!facade) throw new Error('[AsHook] axis-input facade unavailable for asAxisInput.');
    return facade.declare();
  },
});

/** Experimental normalized-axis input; never exposes host coordinates or contacts. */
export function asAxisInput<P extends PropsBaseType = PropsBaseType>(): AxisInputHandle<P> {
  return getAxisInput() as AxisInputHandle<P>;
}
