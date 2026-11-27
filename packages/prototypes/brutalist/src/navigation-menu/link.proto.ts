import { definePrototype, tw } from '@proto.ui/core';
import { BRUTALIST_DISABLED_TOKENS, BRUTALIST_FOCUS_TOKENS } from '../style';
import {
  asNavigationMenuLink,
  type NavigationMenuLinkProps,
  type NavigationMenuLinkExposes,
} from '@proto.ui/prototypes-base/navigation-menu';

export default definePrototype<NavigationMenuLinkProps, NavigationMenuLinkExposes>({
  name: 'brutalist-navigation-menu-link',
  modules: asNavigationMenuLink.modules,
  setup(def) {
    const behavior = asNavigationMenuLink();
    const disabled = behavior.getState!('disabled')!;
    const focused = behavior.getState!('focused')!;
    const focusVisible = behavior.getState!('focusVisible')!;
    def.feedback.style.use(
      tw(
        'flex w-full min-w-0 cursor-pointer select-none items-center rounded-base border-2 border-transparent px-3 py-2 text-sm text-foreground font-sans font-medium text-left no-underline outline-none transition-colors break-words'
      )
    );
    def.rule({
      when: (w) => w.all(w.state(disabled).eq(false), w.state(focused).eq(true)),
      intent: (i) => i.feedback.style.use(tw('bg-main text-main-foreground border-black')),
    });
    def.rule({
      when: (w) =>
        w.all(w.state(disabled).eq(false), w.prop('current').eq(true), w.state(focused).eq(false)),
      intent: (i) =>
        i.feedback.style.use(tw('bg-secondary-background text-foreground border-black')),
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
