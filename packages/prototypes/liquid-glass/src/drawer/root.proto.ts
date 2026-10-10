import { definePrototype, tw } from '@proto.ui/core';
import {
  asDrawerRoot,
  type DrawerRootProps,
  type DrawerRootExposes,
} from '@proto.ui/prototypes-base/drawer';

export default definePrototype<DrawerRootProps, DrawerRootExposes>({
  name: 'liquid-glass-drawer-root',
  setup(def) {
    const behavior = asDrawerRoot();
    def.feedback.style.use(tw('relative inline-flex min-w-0'));
  },
});
