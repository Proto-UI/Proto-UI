import { definePrototype } from '@proto.ui/core';
import { asNavigationMenuLink } from '@proto.ui/prototypes-base/navigation-menu';
import type { NavigationMenuLinkProps, NavigationMenuLinkExposes } from './types';
import { setupNavigationActionPaint } from './visual';
export default definePrototype<NavigationMenuLinkProps, NavigationMenuLinkExposes>({
  name: 'shadcn-navigation-menu-link',
  modules: asNavigationMenuLink.modules,
  setup(def) {
    const behavior = asNavigationMenuLink();
    setupNavigationActionPaint(
      def,
      {
        disabled: behavior.getState!('disabled')!,
        focused: behavior.getState!('focused')!,
        focusVisible: behavior.getState!('focusVisible')!,
      },
      false
    );
  },
});
