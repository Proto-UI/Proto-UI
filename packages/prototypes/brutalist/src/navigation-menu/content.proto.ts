import { definePrototype, tw } from '@proto.ui/core';
import {
  asNavigationMenuContent,
  type NavigationMenuContentProps,
  type NavigationMenuContentExposes,
} from '@proto.ui/prototypes-base/navigation-menu';
export default definePrototype<NavigationMenuContentProps, NavigationMenuContentExposes>({
  name: 'brutalist-navigation-menu-content',
  setup(def) {
    const behavior = asNavigationMenuContent();
    def.feedback.style.use(
      tw(
        'rounded-none border-2 border-foreground bg-background text-foreground shadow-[3px_3px_0_0_var(--pui-foreground)] z-50 min-w-40 max-w-[var(--proto-ui-available-width)] max-h-[var(--proto-ui-available-height)] overflow-y-auto p-1'
      )
    );
  },
});
