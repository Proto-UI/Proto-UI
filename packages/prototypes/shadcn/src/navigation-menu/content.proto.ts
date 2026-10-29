import { definePrototype } from '@proto.ui/core';
import { asNavigationMenuContent } from '@proto.ui/prototypes-base/navigation-menu';
import type { NavigationMenuContentProps, NavigationMenuContentExposes } from './types';
import { NAVIGATION_CONTENT_PAINT, setupNavigationContentPaint } from './visual';
export default definePrototype<NavigationMenuContentProps, NavigationMenuContentExposes>({
  name: 'shadcn-navigation-menu-content',
  modules: asNavigationMenuContent.modules,
  setup(def) {
    asNavigationMenuContent();
    def.context.provide(NAVIGATION_CONTENT_PAINT, { content: true });
    setupNavigationContentPaint(def);
  },
});
