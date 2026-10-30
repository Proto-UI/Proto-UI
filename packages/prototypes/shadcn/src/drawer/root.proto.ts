import { definePrototype, tw } from '@proto.ui/core';
import { asDrawerRoot, type DrawerRootExposes } from '@proto.ui/prototypes-base/drawer';
import type { DrawerRootProps } from './types';
import { setupShadcnStyleScope } from '../style-scope';

export default definePrototype<DrawerRootProps, DrawerRootExposes>({
  name: 'shadcn-drawer-root',
  setup(def) {
    const behavior = asDrawerRoot();
    setupShadcnStyleScope(def);
    def.feedback.style.use(tw('relative inline-flex min-w-0'));
  },
});
