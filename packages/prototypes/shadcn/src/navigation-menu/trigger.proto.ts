import { definePrototype } from '@proto.ui/core';
import { asNavigationMenuTrigger } from '@proto.ui/prototypes-base/navigation-menu';
import type { NavigationMenuTriggerProps, NavigationMenuTriggerExposes } from './types';
import { setupNavigationActionPaint } from './visual';
export default definePrototype<NavigationMenuTriggerProps, NavigationMenuTriggerExposes>({
  name: 'shadcn-navigation-menu-trigger',
  modules: asNavigationMenuTrigger.modules,
  setup(def) {
    const behavior = asNavigationMenuTrigger();
    setupNavigationActionPaint(
      def,
      {
        disabled: behavior.getState!('disabled')!,
        focused: behavior.getState!('focused')!,
        focusVisible: behavior.getState!('focusVisible')!,
        expanded: behavior.getState!('expanded')!,
      },
      true
    );
  },
});
