import { definePrototype, tw } from '@proto.ui/core';
import {
  asDialogTrigger,
  type DialogTriggerProps,
  type DialogTriggerExposes,
} from '@proto.ui/prototypes-base/dialog';

export default definePrototype<DialogTriggerProps, DialogTriggerExposes>({
  name: 'liquid-glass-dialog-trigger',
  setup(def) {
    const behavior = asDialogTrigger();
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
      intent: (i) => i.feedback.style.use(tw('cursor-not-allowed shadow-none')),
    });
  },
});
