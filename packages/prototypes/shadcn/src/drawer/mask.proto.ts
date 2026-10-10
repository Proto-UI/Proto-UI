import { definePrototype, tw } from '@proto.ui/core';
import {
  asDrawerMask,
  type DrawerMaskProps,
  type DrawerMaskExposes,
} from '@proto.ui/prototypes-base/drawer';

export default definePrototype<DrawerMaskProps, DrawerMaskExposes>({
  name: 'shadcn-drawer-mask',
  setup(def) {
    const behavior = asDrawerMask();
    def.feedback.style.use(tw('fixed inset-0 bg-black/50'));
    behavior.asTransition.configure({ enterDuration: 0, leaveDuration: 0 });
  },
});
