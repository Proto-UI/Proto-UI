import { definePrototype, tw } from '@proto.ui/core';
import {
  asNavigationMenuContent,
  type NavigationMenuContentProps,
  type NavigationMenuContentExposes,
} from '@proto.ui/prototypes-base/navigation-menu';
export default definePrototype<NavigationMenuContentProps, NavigationMenuContentExposes>({
  name: 'shadcn-navigation-menu-content',
  setup(def) {
    const behavior = asNavigationMenuContent();
    def.feedback.style.use(
      tw(
        'rounded-lg border border-border bg-popover text-popover-foreground shadow-md z-50 min-w-40 max-w-[var(--proto-ui-available-width)] max-h-[var(--proto-ui-available-height)] overflow-y-auto p-1'
      )
    );
  },
});
