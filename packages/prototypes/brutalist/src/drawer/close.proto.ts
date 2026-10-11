import { definePrototype, tw } from '@proto.ui/core';
import {
  asDrawerClose,
  type DrawerCloseProps,
  type DrawerCloseExposes,
} from '@proto.ui/prototypes-base/drawer';

export default definePrototype<DrawerCloseProps, DrawerCloseExposes>({
  name: 'brutalist-drawer-close',
  setup(def) {
    const behavior = asDrawerClose();
    def.feedback.style.use(
      tw(
        'inline-flex items-center justify-center rounded-none border-2 border-foreground bg-background px-3 py-2 text-sm font-bold outline-none'
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
