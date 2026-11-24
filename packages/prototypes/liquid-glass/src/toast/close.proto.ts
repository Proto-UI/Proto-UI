import { definePrototype, tw } from '@proto.ui/core';
import {
  COMMAND_DISABLED,
  COMMAND_FOCUS,
  COMMAND_FOCUSED_ELEVATION,
} from '../interactive-surface';
import {
  asToastClose,
  type ToastCloseProps,
  type ToastCloseExposes,
} from '@proto.ui/prototypes-base/toast';

export default definePrototype<ToastCloseProps, ToastCloseExposes>({
  name: 'liquid-glass-toast-close',
  setup(def) {
    const behavior = asToastClose();
    const disabled = behavior.getState!('disabled')!;
    const focused = behavior.getState!('focused')!;
    const focusVisible = behavior.getState!('focusVisible')!;
    // Capsule secondary dismiss control; muted fill stays distinct from Root's
    // secondary surface under Reduce Transparency and Increase Contrast.
    def.feedback.style.use(
      tw(
        'rounded-full border border-border bg-muted text-foreground shadow-xs font-sans font-medium text-xs leading-4 inline-flex min-w-0 shrink-0 items-center justify-center h-8 px-3 whitespace-nowrap select-none cursor-pointer outline-none'
      )
    );
    def.rule({
      when: (w) => w.all(w.state(disabled).eq(false), w.state(focused).eq(true)),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUSED_ELEVATION)),
    });
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_DISABLED)),
    });
    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS)),
    });
    return behavior.render;
  },
});
