import { definePrototype } from '@proto.ui/core';
import { asDrawerClose, type DrawerCloseExposes } from '@proto.ui/prototypes-base/drawer';

import type { DrawerCloseProps } from './types';
import { setupDrawerCommandPaint } from './command-paint';

export default definePrototype<DrawerCloseProps, DrawerCloseExposes>({
  name: 'shadcn-drawer-close',
  setup(def) {
    const behavior = asDrawerClose();
    const state = behavior.getState!;
    setupDrawerCommandPaint(def, {
      hovered: state('hovered')!,
      focusVisible: state('focusVisible')!,
      disabled: state('disabled')!,
    });
  },
});
