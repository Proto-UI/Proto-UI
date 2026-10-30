import { definePrototype, tw } from '@proto.ui/core';
import { COMMAND_BLOCKED, COMMAND_FOCUS } from '../interactive-surface';
import {
  asToastClose,
  type ToastCloseProps,
  type ToastCloseExposes,
} from '@proto.ui/prototypes-base/toast';

export default definePrototype<ToastCloseProps, ToastCloseExposes>({
  name: 'liquid-glass-toast-close',
  setup(def) {
    const behavior = asToastClose();
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
