import { definePrototype, tw } from '@proto.ui/core';
import {
  asAlertDialogMask,
  type AlertDialogMaskProps,
  type AlertDialogMaskExposes,
} from '@proto.ui/prototypes-base/alert-dialog';

export default definePrototype<AlertDialogMaskProps, AlertDialogMaskExposes>({
  name: 'brutalist-alert-dialog-mask',
  setup(def) {
    const behavior = asAlertDialogMask();
    behavior.asTransition.configure({ enterDuration: 150, leaveDuration: 150 });
    const { open } = behavior.stateHandles;
    def.feedback.style.use(tw('fixed inset-0 z-40 bg-overlay'));
    def.rule({
      when: (w) => w.state(open).eq(true),
      intent: (i) => i.feedback.style.use(tw('animate-in fade-in-0')),
    });
    def.rule({
      when: (w) => w.state(open).eq(false),
      intent: (i) => i.feedback.style.use(tw('animate-out fade-out-0')),
    });
  },
});
