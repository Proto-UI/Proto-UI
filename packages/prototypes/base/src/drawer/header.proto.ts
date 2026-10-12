import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { DRAWER_FAMILY } from './shared';
import type { DrawerHeaderAsHookContract, DrawerHeaderExposes, DrawerHeaderProps } from './types';

function setupDrawerHeader(def: DefHandle<DrawerHeaderProps, DrawerHeaderExposes>): void {
  def.anatomy.claim(DRAWER_FAMILY, { role: 'header' });
}

export const asDrawerHeader = defineAsHook<
  DrawerHeaderProps,
  DrawerHeaderExposes,
  DrawerHeaderAsHookContract
>({
  name: 'as-drawer-header',
  setup: setupDrawerHeader,
});

export default definePrototype<DrawerHeaderProps, DrawerHeaderExposes>({
  name: 'base-drawer-header',
  setup(def) {
    setupDrawerHeader(def);
    return (renderer) => renderer.r.slot();
  },
});
