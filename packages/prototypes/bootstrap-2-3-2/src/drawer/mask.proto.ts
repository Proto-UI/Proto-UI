import { definePrototype, tw } from '@proto.ui/core';
import {
  asDrawerMask,
  type DrawerMaskProps,
  type DrawerMaskExposes,
} from '@proto.ui/prototypes-base/drawer';

export default definePrototype<DrawerMaskProps, DrawerMaskExposes>({
  name: 'bootstrap-2-3-2-drawer-mask',
  setup(def) {
    const behavior = asDrawerMask();
    def.feedback.style.use(tw('fixed inset-0 bg-black opacity-80'));
    behavior.asTransition.configure({ enterDuration: 0, leaveDuration: 0 });
  },
});
