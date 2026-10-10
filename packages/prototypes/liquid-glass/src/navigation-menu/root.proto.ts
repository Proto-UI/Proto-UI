import { definePrototype, tw } from '@proto.ui/core';
import {
  asNavigationMenuRoot,
  type NavigationMenuRootProps,
  type NavigationMenuRootExposes,
} from '@proto.ui/prototypes-base/navigation-menu';
export default definePrototype<NavigationMenuRootProps, NavigationMenuRootExposes>({
  name: 'liquid-glass-navigation-menu-root',
  setup(def) {
    const behavior = asNavigationMenuRoot();
    def.feedback.style.use(tw('relative flex min-w-0 flex-wrap items-center gap-1'));
  },
});
