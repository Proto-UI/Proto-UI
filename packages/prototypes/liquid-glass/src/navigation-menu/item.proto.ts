import { definePrototype, tw } from '@proto.ui/core';
import { COMMAND_DISABLED, COMMAND_FOCUS_INSET } from '../interactive-surface';
import {
  asNavigationMenuItem,
  type NavigationMenuItemProps,
  type NavigationMenuItemExposes,
} from '@proto.ui/prototypes-base/navigation-menu';

export default definePrototype<NavigationMenuItemProps, NavigationMenuItemExposes>({
  name: 'liquid-glass-navigation-menu-item',
  modules: asNavigationMenuItem.modules,
  setup(def) {
    const behavior = asNavigationMenuItem();
    const disabled = behavior.getState!('disabled')!;
    const focused = behavior.getState!('focused')!;
    const focusVisible = behavior.getState!('focusVisible')!;
    def.feedback.style.use(
      tw(
        'flex w-full min-w-0 cursor-pointer select-none items-center rounded-xl px-3 py-2 text-sm font-medium text-secondary-foreground text-left outline-none transition-colors break-words'
      )
    );
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw(`${COMMAND_DISABLED} text-muted-foreground`)),
    });
    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS_INSET)),
    });
    def.rule({
      when: (w) => w.all(w.state(disabled).eq(false), w.state(focused).eq(true)),
      intent: (i) => i.feedback.style.use(tw('bg-muted text-foreground')),
    });
    return behavior.render;
  },
});
