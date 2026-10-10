import { definePrototype, tw } from '@proto.ui/core';
import {
  asAlertDialogCancel,
  type AlertDialogCancelProps,
  type AlertDialogCancelExposes,
} from '@proto.ui/prototypes-base/alert-dialog';

// Passive family Button paint; the inherited AlertDialog command keeps sole action ownership.
// Keep the valid borrowed getState pattern. Source collector coverage is a separate owner.
export default definePrototype<AlertDialogCancelProps, AlertDialogCancelExposes>({
  name: 'shadcn-alert-dialog-cancel',
  setup(def) {
    const behavior = asAlertDialogCancel();
    const state = behavior.getState!;
    def.feedback.style.use(
      tw(
        'inline-flex shrink-0 items-center justify-center rounded-lg border bg-clip-padding text-sm font-medium transition-all outline-none select-none min-h-8 gap-1.5 px-2.5 py-1 min-w-0 max-w-full whitespace-normal wrap-anywhere'
      )
    );
    def.feedback.style.use(tw('border-border bg-background text-foreground'));
    def.rule({
      when: (w) => w.state(state('hovered')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-muted text-foreground')),
    });
    def.rule({
      when: (w) => w.state(state('pressed')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('translate-y-px')),
    });
    def.rule({
      when: (w) => w.state(state('focusVisible')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('border-ring ring-3 ring-ring/50')),
    });
    def.rule({
      when: (w) => w.state(state('disabled')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('pointer-events-none opacity-50')),
    });
    def.rule({
      when: (w) => w.meta('colorScheme').eq('dark'),
      intent: (i) => i.feedback.style.use(tw('border-input bg-input/30')),
    });
    def.rule({
      when: (w) => w.all(w.meta('colorScheme').eq('dark'), w.state(state('hovered')!).eq(true)),
      intent: (i) => i.feedback.style.use(tw('bg-input/50')),
    });
  },
});
