import type { TextControlHandle } from '@proto.ui/core';
import type { PropsBaseType } from '@proto.ui/types';
import { definePrivilegedAsHook } from './privileged';

type TextControlFacade = {
  declare<P extends PropsBaseType = PropsBaseType>(): TextControlHandle<P>;
};

export function asTextControl<P extends PropsBaseType = PropsBaseType>(): TextControlHandle<P> {
  return getTextControl() as TextControlHandle<P>;
}

const getTextControl = definePrivilegedAsHook<PropsBaseType, TextControlHandle<PropsBaseType>>({
  name: 'asTextControl',
  setup: ({ facades }) => {
    const facade = facades['text-control'] as TextControlFacade | undefined;
    if (!facade || typeof facade.declare !== 'function') {
      throw new Error('[AsHook] text-control facade unavailable for asTextControl.');
    }
    return facade.declare();
  },
});
