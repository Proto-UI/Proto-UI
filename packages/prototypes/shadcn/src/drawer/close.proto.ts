import { definePrototype, tw } from '@proto.ui/core';
import {
  asDrawerClose,
  type DrawerCloseProps,
  type DrawerCloseExposes,
} from '@proto.ui/prototypes-base/drawer';

export default definePrototype<DrawerCloseProps, DrawerCloseExposes>({
  name: 'shadcn-drawer-close',
  setup(def) {
    const behavior = asDrawerClose();
    def.feedback.style.use(
      tw(
        'inline-flex items-center justify-center rounded-lg border border-input bg-background min-h-8 px-2.5 py-0 text-sm font-medium min-w-0 max-w-full whitespace-normal wrap-anywhere text-center outline-none'
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
