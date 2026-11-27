import { definePrototype, tw } from '@proto.ui/core';
import { BRUTALIST_DISABLED_TOKENS, BRUTALIST_FOCUS_TOKENS } from '../style';
import {
  asNavigationMenuItem,
  type NavigationMenuItemProps,
  type NavigationMenuItemExposes,
} from '@proto.ui/prototypes-base/navigation-menu';

export default definePrototype<NavigationMenuItemProps, NavigationMenuItemExposes>({
  name: 'brutalist-navigation-menu-item',
  modules: asNavigationMenuItem.modules,
  setup(def) {
    const behavior = asNavigationMenuItem();
    const disabled = behavior.getState!('disabled')!;
    const focused = behavior.getState!('focused')!;
    const focusVisible = behavior.getState!('focusVisible')!;
    def.feedback.style.use(
      tw(
        'flex w-full min-w-0 cursor-pointer select-none items-center rounded-base border-2 border-transparent px-3 py-2 text-sm text-foreground font-sans font-medium text-left outline-none transition-colors break-words'
      )
    );
    def.rule({
      when: (w) => w.all(w.state(disabled).eq(false), w.state(focused).eq(true)),
      intent: (i) => i.feedback.style.use(tw('bg-main text-main-foreground border-black')),
    });
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw(`${BRUTALIST_DISABLED_TOKENS} cursor-not-allowed`)),
    });
    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw(BRUTALIST_FOCUS_TOKENS)),
    });
    return behavior.render;
  },
});
