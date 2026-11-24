import { definePrototype, tw } from '@proto.ui/core';
import {
  asAlertDialogMask,
  type AlertDialogMaskProps,
  type AlertDialogMaskExposes,
} from '@proto.ui/prototypes-base/alert-dialog';

export default definePrototype<AlertDialogMaskProps, AlertDialogMaskExposes>({
  name: 'liquid-glass-alert-dialog-mask',
  modules: asAlertDialogMask.modules,
  setup(def) {
    const behavior = asAlertDialogMask();
    const { open } = behavior.stateHandles;
    def.feedback.style.use(tw('fixed inset-0 z-40 bg-black/40'));
    def.rule({
      when: (w) => w.state(open).eq(true),
      intent: (i) => i.feedback.style.use(tw('animate-in fade-in-0 duration-200')),
    });
    def.rule({
      when: (w) => w.state(open).eq(false),
      intent: (i) => i.feedback.style.use(tw('animate-out fade-out-0 duration-150')),
    });
    behavior.asTransition.configure({ enterDuration: 200, leaveDuration: 150 });
  },
});
