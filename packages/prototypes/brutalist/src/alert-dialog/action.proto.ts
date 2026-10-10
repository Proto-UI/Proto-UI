import { definePrototype, tw } from '@proto.ui/core';
import {
  asAlertDialogAction,
  type AlertDialogActionProps,
  type AlertDialogActionExposes,
} from '@proto.ui/prototypes-base/alert-dialog';
import {
  BRUTALIST_STRUCTURE_TOKENS,
  BRUTALIST_HOVER_LIFT_TOKENS,
  BRUTALIST_PRESS_TOKENS,
  BRUTALIST_MOTION_HIT_TOKENS,
  BRUTALIST_FOCUS_TOKENS,
  BRUTALIST_DISABLED_TOKENS,
} from '../style';

// Passive family Button paint; the inherited AlertDialog command keeps sole action ownership.
// Keep the valid borrowed getState pattern. Source collector coverage is a separate owner.
export default definePrototype<AlertDialogActionProps, AlertDialogActionExposes>({
  name: 'brutalist-alert-dialog-action',
  setup(def) {
    const behavior = asAlertDialogAction();
    const state = behavior.getState!;
    def.feedback.style.use(
      tw(
        'inline-flex shrink-0 items-center justify-center gap-2 select-none font-sans font-medium min-h-10 px-4 py-2 text-sm min-w-0 max-w-full whitespace-normal wrap-anywhere'
      )
    );
    def.feedback.style.use(tw(BRUTALIST_STRUCTURE_TOKENS));
    def.feedback.style.use(tw('bg-main text-main-foreground'));
    def.rule({
      when: (w) => w.state(state('hovered')!).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw(`${BRUTALIST_HOVER_LIFT_TOKENS} ${BRUTALIST_MOTION_HIT_TOKENS}`)),
    });
    def.rule({
      when: (w) => w.state(state('pressed')!).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw(`${BRUTALIST_PRESS_TOKENS} ${BRUTALIST_MOTION_HIT_TOKENS}`)),
    });
    def.rule({
      when: (w) => w.state(state('focusVisible')!).eq(true),
      intent: (i) => i.feedback.style.use(tw(BRUTALIST_FOCUS_TOKENS)),
    });
    def.rule({
      when: (w) => w.state(state('disabled')!).eq(true),
      intent: (i) => i.feedback.style.use(tw(BRUTALIST_DISABLED_TOKENS)),
    });
  },
});
