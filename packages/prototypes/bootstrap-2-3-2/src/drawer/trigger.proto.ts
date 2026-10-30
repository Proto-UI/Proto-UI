import { definePrototype } from '@proto.ui/core';
import {
  asDrawerTrigger,
  type DrawerTriggerProps,
  type DrawerTriggerExposes,
} from '@proto.ui/prototypes-base/drawer';
import { setupButtonVisual } from '../button/visual';

export default definePrototype<DrawerTriggerProps, DrawerTriggerExposes>({
  name: 'bootstrap-2-3-2-drawer-trigger',
  setup(def) {
    const behavior = asDrawerTrigger();
    const state = behavior.stateHandles;
    if (!state) throw new Error('[bootstrap-2-3-2-drawer-trigger] Base state handles required.');
    setupButtonVisual(def, state);
    return behavior.render;
  },
});
