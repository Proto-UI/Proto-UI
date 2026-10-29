import { definePrototype } from '@proto.ui/core';
import { asNavigationMenuContent } from '@proto.ui/prototypes-base/navigation-menu';
import type { NavigationMenuContentProps, NavigationMenuContentExposes } from './types';
import { setupNavigationContentPaint } from './visual';
export default definePrototype<NavigationMenuContentProps, NavigationMenuContentExposes>({
  name: 'shadcn-navigation-menu-content',
  modules: asNavigationMenuContent.modules,
  setup(def) {
    asNavigationMenuContent();
    setupNavigationContentPaint(def);
  },
});
