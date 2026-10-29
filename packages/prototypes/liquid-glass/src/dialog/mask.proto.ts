import { definePrototype, tw } from '@proto.ui/core';
import {
  asDialogMask,
  type DialogMaskProps,
  type DialogMaskExposes,
} from '@proto.ui/prototypes-base/dialog';

export default definePrototype<DialogMaskProps, DialogMaskExposes>({
  name: 'liquid-glass-dialog-mask',
  setup(def) {
    const behavior = asDialogMask();
    def.feedback.style.use(tw('fixed inset-0 bg-black/50'));
    behavior.asTransition.configure({ enterDuration: 0, leaveDuration: 0 });
  },
});
