import { definePrototype } from '@proto.ui/core';
import { asDrawerTrigger, type DrawerTriggerExposes } from '@proto.ui/prototypes-base/drawer';

import type { DrawerTriggerProps } from './types';
import { setupDrawerCommandPaint } from './command-paint';

export default definePrototype<DrawerTriggerProps, DrawerTriggerExposes>({
  name: 'shadcn-drawer-trigger',
  setup(def) {
    const behavior = asDrawerTrigger();
    const state = behavior.getState!;
    setupDrawerCommandPaint(def, {
      hovered: state('hovered')!,
      focusVisible: state('focusVisible')!,
      disabled: state('disabled')!,
    });
  },
});
