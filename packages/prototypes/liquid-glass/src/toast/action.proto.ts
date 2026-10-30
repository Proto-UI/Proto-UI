import { definePrototype, tw } from '@proto.ui/core';
import { COMMAND_BLOCKED, COMMAND_FOCUS } from '../interactive-surface';
import {
  asToastAction,
  type ToastActionProps,
  type ToastActionExposes,
} from '@proto.ui/prototypes-base/toast';

export default definePrototype<ToastActionProps, ToastActionExposes>({
  name: 'liquid-glass-toast-action',
  setup(def) {
    const behavior = asToastAction();
    def.feedback.style.use(
      tw(
        'rounded-xl border border-border bg-secondary text-secondary-foreground inline-flex min-w-0 items-center justify-center px-3 py-2 outline-none'
      )
    );
    def.rule({
      when: (w) => w.state(behavior.getState!('disabled')!).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_BLOCKED)),
    });
    def.rule({
      when: (w) => w.state(behavior.getState!('focusVisible')!).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS)),
    });
    return behavior.render;
  },
});
