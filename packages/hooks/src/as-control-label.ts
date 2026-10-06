import type { ControlLabelFacade } from '@proto.ui/core';
import type { PropsBaseType } from '@proto.ui/types';
import { definePrivilegedAsHook } from './privileged';
/** Bounded label pairing only; targets retain their existing activation operation. */
export const asControlLabel = definePrivilegedAsHook<PropsBaseType, ControlLabelFacade>({
  name: 'asControlLabel',
  setup: ({ facades }) => {
    const facade = facades['control-label'] as ControlLabelFacade | undefined;
    if (!facade) throw new Error('[AsHook] control-label facade unavailable');
    return facade;
  },
});
