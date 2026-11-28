import { createContextKey, definePrototype, tw } from '@proto.ui/core';
import { BRUTALIST_PANEL_TOKENS } from '../style';
import {
  asNavigationMenuContent,
  type NavigationMenuContentProps,
  type NavigationMenuContentExposes,
} from '@proto.ui/prototypes-base/navigation-menu';

export const BRUTALIST_NAVIGATION_CONTENT_PAINT = createContextKey<{ content: boolean }>(
  'brutalist-navigation-content-paint'
);

export default definePrototype<NavigationMenuContentProps, NavigationMenuContentExposes>({
  name: 'brutalist-navigation-menu-content',
  modules: asNavigationMenuContent.modules,
  setup(def) {
    const behavior = asNavigationMenuContent();
    def.context.provide(BRUTALIST_NAVIGATION_CONTENT_PAINT, { content: true });
    def.feedback.style.use(
      tw(
        `${BRUTALIST_PANEL_TOKENS} shadow-[3px_3px_0_0_var(--pui-foreground)] z-50 min-w-48 max-w-[var(--proto-ui-available-width)] max-h-[var(--proto-ui-available-height)] overflow-y-auto p-1.5 outline-none`
      )
    );
    return behavior.render;
  },
});
