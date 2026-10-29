import { definePrototype, tw } from '@proto.ui/core';
import { COMMAND_FOCUS_INSET } from '../interactive-surface';
import {
  asNavigationMenuItem,
  type NavigationMenuItemProps,
  type NavigationMenuItemExposes,
} from '@proto.ui/prototypes-base/navigation-menu';
export default definePrototype<NavigationMenuItemProps, NavigationMenuItemExposes>({
  name: 'liquid-glass-navigation-menu-item',
  setup(def) {
    const behavior = asNavigationMenuItem();
    def.feedback.style.use(
      tw('flex min-w-0 items-center rounded-sm px-3 py-2 text-sm outline-none break-words')
    );
    def.rule({
      when: (w) => w.state(behavior.getState!('disabled')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('text-muted-foreground cursor-not-allowed')),
    });
    def.rule({
      when: (w) => w.state(behavior.getState!('focusVisible')!).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS_INSET)),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(behavior.getState!('focused')!).eq(true),
          w.state(behavior.getState!('disabled')!).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-primary text-primary-foreground')),
    });
    return behavior.render;
  },
});
