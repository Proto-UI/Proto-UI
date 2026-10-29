import { definePrototype, tw } from '@proto.ui/core';
import { asNavigationMenuRoot } from '@proto.ui/prototypes-base/navigation-menu';
import type { NavigationMenuRootProps, NavigationMenuRootExposes } from './types';
import { setupShadcnStyleScope } from '../style-scope';
import { NAVIGATION_CONTENT_PAINT } from './visual';
export default definePrototype<NavigationMenuRootProps, NavigationMenuRootExposes>({
  name: 'shadcn-navigation-menu-root',
  modules: asNavigationMenuRoot.modules,
  setup(def) {
    asNavigationMenuRoot();
    def.context.provide(NAVIGATION_CONTENT_PAINT, { content: false });
    setupShadcnStyleScope(def);
    def.feedback.style.use(tw('relative flex max-w-max flex-1 items-center justify-center'));
  },
});
