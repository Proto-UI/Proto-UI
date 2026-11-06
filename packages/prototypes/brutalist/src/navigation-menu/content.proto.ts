import { definePrototype, tw } from '@proto.ui/core';
import { BRUTALIST_PANEL_TOKENS } from '../style';
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
        `${BRUTALIST_PANEL_TOKENS} z-50 min-w-40 max-w-[var(--proto-ui-available-width)] max-h-[var(--proto-ui-available-height)] overflow-y-auto p-1`
      )
    );
  },
});
