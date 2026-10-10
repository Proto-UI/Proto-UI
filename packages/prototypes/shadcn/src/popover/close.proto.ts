import { definePrototype, tw } from '@proto.ui/core';
import {
  asPopoverClose,
  type PopoverCloseProps,
  type PopoverCloseExposes,
} from '@proto.ui/prototypes-base/popover';

export default definePrototype<PopoverCloseProps, PopoverCloseExposes>({
  name: 'shadcn-popover-close',
  setup(def) {
    const behavior = asPopoverClose();
    def.feedback.style.use(
      tw(
        'inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-sm font-medium outline-none'
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
