import { definePrototype, tw } from '@proto.ui/core';
import {
  asNavigationMenuTrigger,
  type NavigationMenuTriggerProps,
  type NavigationMenuTriggerExposes,
} from '@proto.ui/prototypes-base/navigation-menu';
export default definePrototype<NavigationMenuTriggerProps, NavigationMenuTriggerExposes>({
  name: 'brutalist-navigation-menu-trigger',
  setup(def) {
    const behavior = asNavigationMenuTrigger();
    def.feedback.style.use(
      tw(
        'rounded-none border-2 border-foreground inline-flex min-w-0 items-center justify-center px-3 py-2 text-sm font-medium outline-none'
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
  },
});
