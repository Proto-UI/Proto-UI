import { definePrototype, tw } from '@proto.ui/core';
import {
  asDrawerTrigger,
  type DrawerTriggerProps,
  type DrawerTriggerExposes,
} from '@proto.ui/prototypes-base/drawer';

export default definePrototype<DrawerTriggerProps, DrawerTriggerExposes>({
  name: 'bootstrap-2-3-2-drawer-trigger',
  setup(def) {
    const behavior = asDrawerTrigger();
    def.feedback.style.use(
      tw(
        'inline-flex items-center justify-center rounded border border-border bg-secondary px-3 py-1.5 text-sm text-secondary-foreground shadow-sm outline-none'
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
