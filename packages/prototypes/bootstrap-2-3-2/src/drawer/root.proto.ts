import { definePrototype, tw } from '@proto.ui/core';
import {
  asDrawerRoot,
  type DrawerRootProps,
  type DrawerRootExposes,
} from '@proto.ui/prototypes-base/drawer';

export default definePrototype<DrawerRootProps, DrawerRootExposes>({
  name: 'bootstrap-2-3-2-drawer-root',
  setup(def) {
    const behavior = asDrawerRoot();
    def.feedback.style.use(tw('relative inline-flex min-w-0'));
  },
});
