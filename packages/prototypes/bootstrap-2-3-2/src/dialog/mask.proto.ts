import { definePrototype, tw } from '@proto.ui/core';
import {
  asDialogMask,
  type DialogMaskProps,
  type DialogMaskExposes,
} from '@proto.ui/prototypes-base/dialog';

// Upstream .modal-backdrop is fixed @black at .opacity(80); its fade rides the shared
// .fade opacity .15s linear (twbs/bootstrap@b4c4072 less/modals.less,
// less/component-animations.less). Presence endpoints keep the 0 -> 0.8 opacity path;
// the 150ms retention and host-managed reduced motion stay on the Transition module.
export default definePrototype<DialogMaskProps, DialogMaskExposes>({
  name: 'bootstrap-2-3-2-dialog-mask',
  setup(def) {
    const behavior = asDialogMask();
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
