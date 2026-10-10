import { definePrototype, tw } from '@proto.ui/core';
import {
  asAlertDialogCancel,
  type AlertDialogCancelProps,
  type AlertDialogCancelExposes,
} from '@proto.ui/prototypes-base/alert-dialog';
import {
  bootstrapButtonFill,
  bootstrapButtonActiveFill,
  bootstrapButtonRaised,
  bootstrapButtonPressed,
} from '../button/paint';

// Passive family Button paint; the inherited AlertDialog command keeps sole action ownership.
// Keep the valid borrowed getState pattern. Source collector coverage is a separate owner.
export default definePrototype<AlertDialogCancelProps, AlertDialogCancelExposes>({
  name: 'bootstrap-2-3-2-alert-dialog-cancel',
  setup(def) {
    const behavior = asAlertDialogCancel();
    const state = behavior.getState!;
    def.feedback.style.use(
      tw(
        'inline-flex shrink-0 items-center justify-center rounded-[4px] border px-3 py-1 text-sm font-normal leading-5 select-none cursor-pointer min-w-0 max-w-full whitespace-normal wrap-anywhere'
      )
    );
    def.feedback.style.use(tw(bootstrapButtonRaised));
    def.feedback.style.use(tw(bootstrapButtonFill['default']));
    def.rule({
      when: (w) => w.state(state('hovered')!).eq(true),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonActiveFill['default'])),
    });
    def.rule({
      when: (w) => w.state(state('pressed')!).eq(true),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonActiveFill['default'])),
    });
    def.rule({
      when: (w) => w.state(state('disabled')!).eq(true),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonActiveFill['default'])),
    });
    def.rule({
      when: (w) => w.state(state('pressed')!).eq(true),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonPressed)),
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
      intent: (i) =>
        i.feedback.style.use(tw('opacity-65 pointer-events-none cursor-default shadow-none')),
    });
  },
});
