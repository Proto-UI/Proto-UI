import type { ContextMenuInputHandle } from '@proto.ui/core';
import type { PropsBaseType } from '@proto.ui/types';
import { definePrivilegedAsHook } from './privileged';

type Facade = { declareContextMenuInput(): ContextMenuInputHandle };
const install = definePrivilegedAsHook<PropsBaseType, ContextMenuInputHandle>({
  name: 'asContextMenuInput',
  setup: ({ facades }) => {
    const facade = facades.positioning as Facade | undefined;
    if (!facade) throw new Error('[AsHook] positioning facade unavailable for asContextMenuInput.');
    return facade.declareContextMenuInput();
  },
});
/** Experimental source-runtime input intent; geometry remains entirely host-local. */
export function asContextMenuInput<
  P extends PropsBaseType = PropsBaseType,
>(): ContextMenuInputHandle<P> {
  return install() as ContextMenuInputHandle<P>;
}
