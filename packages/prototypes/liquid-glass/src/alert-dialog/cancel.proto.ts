import { definePrototype, tw } from '@proto.ui/core';
import {
  asAlertDialogCancel,
  type AlertDialogCancelProps,
  type AlertDialogCancelExposes,
} from '@proto.ui/prototypes-base/alert-dialog';

// Passive family Button paint; the inherited AlertDialog command keeps sole action ownership.
// Keep the valid borrowed getState pattern. Source collector coverage is a separate owner.
export default definePrototype<AlertDialogCancelProps, AlertDialogCancelExposes>({
  name: 'liquid-glass-alert-dialog-cancel',
  setup(def) {
    const behavior = asAlertDialogCancel();
    const state = behavior.getState!;
    def.feedback.style.use(
      tw(
        'inline-flex shrink-0 items-center justify-center rounded-full border border-border px-5 py-2 text-sm font-medium select-none cursor-pointer shadow-sm min-w-0 max-w-full whitespace-normal wrap-anywhere'
      )
    );
    def.feedback.style.use(tw('bg-secondary text-secondary-foreground'));
    def.rule({
      when: (w) => w.state(state('hovered')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('shadow-md')),
    });
    def.rule({
      when: (w) => w.state(state('pressed')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('shadow-xs')),
    });
    def.rule({
      when: (w) => w.state(state('focusVisible')!).eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw('outline-none ring-2 ring-ring ring-offset-2 ring-offset-background')
        ),
    });
    def.rule({
      when: (w) => w.state(state('disabled')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 pointer-events-none cursor-default')),
    });
  },
});
