import { definePrototype, tw } from '@proto.ui/core';
import {
  asNavigationMenuRoot,
  type NavigationMenuRootProps,
  type NavigationMenuRootExposes,
} from '@proto.ui/prototypes-base/navigation-menu';

export default definePrototype<NavigationMenuRootProps, NavigationMenuRootExposes>({
  name: 'liquid-glass-navigation-menu-root',
  modules: asNavigationMenuRoot.modules,
  setup(def) {
    const behavior = asNavigationMenuRoot();
    def.feedback.style.use(
      tw(
        'relative inline-flex max-w-max min-w-0 flex-wrap items-center gap-1 rounded-full border border-border bg-secondary p-1 text-secondary-foreground shadow-sm'
      )
    );
    return behavior.render;
  },
});
