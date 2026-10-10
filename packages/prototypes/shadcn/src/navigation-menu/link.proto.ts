import { definePrototype, tw } from '@proto.ui/core';
import {
  asNavigationMenuLink,
  type NavigationMenuLinkProps,
  type NavigationMenuLinkExposes,
} from '@proto.ui/prototypes-base/navigation-menu';
export default definePrototype<NavigationMenuLinkProps, NavigationMenuLinkExposes>({
  name: 'shadcn-navigation-menu-link',
  modules: asNavigationMenuLink.modules,
  setup(def) {
    const behavior = asNavigationMenuLink();
    def.feedback.style.use(
      tw(
        'flex min-w-0 items-center rounded-sm px-3 py-2 text-sm underline underline-offset-4 outline-none break-words'
      )
    );
    def.rule({
      when: (w) => w.state(behavior.getState!('disabled')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-not-allowed')),
    });
    def.rule({
      when: (w) => w.state(behavior.getState!('focusVisible')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('ring-2 ring-inset ring-ring')),
    });
    def.rule({
      when: (w) => w.state(behavior.getState!('focused')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-primary text-primary-foreground')),
    });
  },
});
