import { definePrototype } from '@proto.ui/core';
import {
  asDrawerClose,
  type DrawerCloseProps,
  type DrawerCloseExposes,
} from '@proto.ui/prototypes-base/drawer';
import { setupButtonVisual } from '../button/visual';

export default definePrototype<DrawerCloseProps, DrawerCloseExposes>({
  name: 'bootstrap-2-3-2-drawer-close',
  setup(def) {
    const behavior = asDrawerClose();
    const state = behavior.stateHandles;
    if (!state) throw new Error('[bootstrap-2-3-2-drawer-close] Base state handles required.');
    setupButtonVisual(def, state);
    return behavior.render;
  },
});
