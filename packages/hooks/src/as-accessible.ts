import type { AccessibleHandle } from '@proto.ui/core';
import type { PropsBaseType } from '@proto.ui/types';
import { definePrivilegedAsHook } from './privileged';

/** Declare accessibility semantics for this instance; does not install interaction behavior. */
export const asAccessible = definePrivilegedAsHook<PropsBaseType, AccessibleHandle>({
  name: 'asAccessible',
  setup: ({ facades }) => {
    const facade = facades.a11y as AccessibleHandle | undefined;
    if (!facade || typeof facade.role !== 'function') {
      throw new Error('[AsHook] a11y facade unavailable for asAccessible.');
    }
    return facade;
  },
});
