import { definePrototype, tw } from '@proto.ui/core';
import {
  asAlertDialogMask,
  type AlertDialogMaskProps,
  type AlertDialogMaskExposes,
} from '@proto.ui/prototypes-base/alert-dialog';

export default definePrototype<AlertDialogMaskProps, AlertDialogMaskExposes>({
  name: 'bootstrap-2-3-2-alert-dialog-mask',
  modules: asAlertDialogMask.modules,
  setup(def) {
    const behavior = asAlertDialogMask();
    // Bootstrap 2.3.2 .modal-backdrop.fade: 150ms linear, entered opacity .8.
    def.feedback.style.use(tw('fixed inset-0 bg-black'));
    behavior.asTransition.configure({ enterDuration: 150, leaveDuration: 150 });
    def.feedback.style.presence({
      owner: behavior.asTransition.presentationOwner,
      closed: { opacity: 0 },
      entered: { opacity: 0.8 },
      easing: [0, 0, 1, 1],
    });
  },
});
