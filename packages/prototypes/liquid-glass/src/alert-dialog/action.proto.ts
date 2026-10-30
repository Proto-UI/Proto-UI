import { definePrototype, tw } from '@proto.ui/core';
import {
  COMMAND_BLOCKED,
  COMMAND_FOCUS,
  COMMAND_HOVER,
  COMMAND_PRESS,
} from '../interactive-surface';
import {
  asAlertDialogAction,
  type AlertDialogActionProps,
  type AlertDialogActionExposes,
} from '@proto.ui/prototypes-base/alert-dialog';

// Family command paint; AlertDialog keeps sole activation and focus ownership.
export default definePrototype<AlertDialogActionProps, AlertDialogActionExposes>({
  name: 'liquid-glass-alert-dialog-action',
  setup(def) {
    const behavior = asAlertDialogAction();
    const state = behavior.getState!;
    def.feedback.style.use(
      tw(
        'inline-flex shrink-0 items-center justify-center rounded-full border border-border px-5 py-2 text-sm font-medium select-none cursor-pointer shadow-sm min-w-0 max-w-full whitespace-normal wrap-anywhere'
      )
    );
    def.feedback.style.use(tw('bg-primary text-primary-foreground'));
    def.rule({
      when: (w) =>
        w.all(
          w.state(state('hovered')!).eq(true),
          w.state(state('pressed')!).eq(false),
          w.state(state('focusVisible')!).eq(false),
          w.state(state('disabled')!).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw(COMMAND_HOVER)),
    });
    def.rule({
      when: (w) =>
        w.all(w.state(state('pressed')!).eq(true), w.state(state('disabled')!).eq(false)),
      intent: (i) => i.feedback.style.use(tw(COMMAND_PRESS)),
    });
    def.rule({
      when: (w) => w.state(state('focusVisible')!).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS)),
    });
    def.rule({
      when: (w) => w.state(state('disabled')!).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_BLOCKED)),
    });
    return behavior.render;
  },
});
