import { definePrototype, tw } from '@proto.ui/core';
import {
  COMMAND_DISABLED,
  COMMAND_FOCUS,
  COMMAND_FOCUSED_ELEVATION,
} from '../interactive-surface';
import {
  asToastAction,
  type ToastActionProps,
  type ToastActionExposes,
} from '@proto.ui/prototypes-base/toast';

export default definePrototype<ToastActionProps, ToastActionExposes>({
  name: 'liquid-glass-toast-action',
  setup(def) {
    const behavior = asToastAction();
    const disabled = behavior.getState!('disabled')!;
    const focused = behavior.getState!('focused')!;
    const focusVisible = behavior.getState!('focusVisible')!;
    // Capsule control without stacked glass; distinct primary fill preserves
    // figure-ground separation over the Root's secondary opaque fallback.
    def.feedback.style.use(
      tw(
        'rounded-full border border-transparent shadow-xs font-sans font-medium text-xs leading-4 inline-flex min-w-0 shrink-0 items-center justify-center h-8 px-3.5 whitespace-nowrap select-none cursor-pointer outline-none'
      )
    );
    def.rule({
      when: (w) => w.state(disabled).eq(false),
      intent: (i) => i.feedback.style.use(tw('bg-primary text-primary-foreground')),
    });
    def.rule({
      when: (w) => w.all(w.state(disabled).eq(false), w.state(focused).eq(true)),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUSED_ELEVATION)),
    });
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw(`bg-muted text-foreground ${COMMAND_DISABLED}`)),
    });
    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS)),
    });
    return behavior.render;
  },
});
