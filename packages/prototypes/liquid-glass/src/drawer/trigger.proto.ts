import { definePrototype, tw } from '@proto.ui/core';
import {
  asDrawerTrigger,
  type DrawerTriggerProps,
  type DrawerTriggerExposes,
} from '@proto.ui/prototypes-base/drawer';

export default definePrototype<DrawerTriggerProps, DrawerTriggerExposes>({
  name: 'liquid-glass-drawer-trigger',
  setup(def) {
    const behavior = asDrawerTrigger();
    def.feedback.style.use(
      tw(
        'inline-flex items-center justify-center rounded-full border border-border bg-secondary px-4 py-2 text-sm text-secondary-foreground outline-none'
      )
    );
    const state = behavior.getState!;
    def.rule({
      when: (w) => w.state(state('focusVisible')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('ring-2 ring-ring ring-offset-2')),
    });
    def.rule({
      when: (w) => w.state(state('disabled')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-not-allowed')),
    });
  },
});
