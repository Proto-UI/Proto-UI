import { definePrototype, tw } from '@proto.ui/core';
import {
  asDrawerMask,
  type DrawerMaskProps,
  type DrawerMaskExposes,
} from '@proto.ui/prototypes-base/drawer';

export default definePrototype<DrawerMaskProps, DrawerMaskExposes>({
  name: 'brutalist-drawer-mask',
  setup(def) {
    const behavior = asDrawerMask();
    def.feedback.style.use(tw('fixed inset-0 bg-black/50'));
    behavior.asTransition.configure({
      enterDuration: 150,
      leaveDuration: 150,
      completion: { kind: 'presentation', timeoutMs: 500 },
    });
    def.feedback.style.presence({
      owner: behavior.asTransition.presentationOwner,
      closed: { opacity: 0 },
      entered: { opacity: 1 },
      easing: [0, 0, 1, 1],
    });
  },
});
