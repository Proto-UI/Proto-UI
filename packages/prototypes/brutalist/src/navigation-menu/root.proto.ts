import { definePrototype, tw } from '@proto.ui/core';
import {
  asNavigationMenuRoot,
  type NavigationMenuRootProps,
  type NavigationMenuRootExposes,
} from '@proto.ui/prototypes-base/navigation-menu';

export default definePrototype<NavigationMenuRootProps, NavigationMenuRootExposes>({
  name: 'brutalist-navigation-menu-root',
  modules: asNavigationMenuRoot.modules,
  setup(def) {
    const behavior = asNavigationMenuRoot();
    def.feedback.style.use(
      tw(
        'relative z-10 inline-flex max-w-max min-w-0 flex-wrap items-center justify-center gap-1 rounded-base border-2 border-black bg-main p-1 text-main-foreground font-sans font-medium'
      )
    );
    return behavior.render;
  },
});
