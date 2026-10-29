import { definePrototype } from '@proto.ui/core';
import { asNavigationMenuItem } from '@proto.ui/prototypes-base/navigation-menu';
import type { NavigationMenuItemProps, NavigationMenuItemExposes } from './types';
import { setupNavigationActionPaint } from './visual';
export default definePrototype<NavigationMenuItemProps, NavigationMenuItemExposes>({
  name: 'shadcn-navigation-menu-item',
  modules: asNavigationMenuItem.modules,
  setup(def) {
    const behavior = asNavigationMenuItem();
    // Proto's action Item is not upstream's passive Item container. Use the
    // family's link grammar without replacing its actual Base action owner.
    setupNavigationActionPaint(
      def,
      {
        disabled: behavior.getState!('disabled')!,
        focused: behavior.getState!('focused')!,
        focusVisible: behavior.getState!('focusVisible')!,
      },
      'item'
    );
  },
});
