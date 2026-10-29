import { definePrototype, tw } from '@proto.ui/core';
import {
  asNavigationMenuContent,
  type NavigationMenuContentProps,
  type NavigationMenuContentExposes,
} from '@proto.ui/prototypes-base/navigation-menu';
export default definePrototype<NavigationMenuContentProps, NavigationMenuContentExposes>({
  name: 'bootstrap-2-3-2-navigation-menu-content',
  modules: asNavigationMenuContent.modules,
  setup(def) {
    const behavior = asNavigationMenuContent();
    def.props.setDefaults({ sideOffset: 2 });
    def.feedback.style.use(
      tw(
        'z-[1000] min-w-[160px] max-w-[var(--proto-ui-available-width)] max-h-[var(--proto-ui-available-height)] overflow-y-auto rounded-[6px] border border-[rgb(0_0_0/20%)] bg-background bg-clip-padding text-foreground py-[5px] shadow-[0_5px_10px_rgb(0_0_0/20%)]'
      )
    );
    return behavior.render;
  },
});
