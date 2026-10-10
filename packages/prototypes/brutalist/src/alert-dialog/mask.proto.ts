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
    def.feedback.style.use(tw('fixed inset-0 bg-overlay'));
    behavior.asTransition.configure({ enterDuration: 0, leaveDuration: 0 });
  },
});
