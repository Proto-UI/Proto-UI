import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { DRAWER_FAMILY } from './shared';
import type { DrawerFooterAsHookContract, DrawerFooterExposes, DrawerFooterProps } from './types';

function setupDrawerFooter(def: DefHandle<DrawerFooterProps, DrawerFooterExposes>): void {
  def.anatomy.claim(DRAWER_FAMILY, { role: 'footer' });
}

export const asDrawerFooter = defineAsHook<
  DrawerFooterProps,
  DrawerFooterExposes,
  DrawerFooterAsHookContract
>({
  name: 'as-drawer-footer',
  setup: setupDrawerFooter,
});

export default definePrototype<DrawerFooterProps, DrawerFooterExposes>({
  name: 'base-drawer-footer',
  setup(def) {
    setupDrawerFooter(def);
    return (renderer) => renderer.r.slot();
  },
});
