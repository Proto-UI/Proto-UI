import { definePrototype, tw } from '@proto.ui/core';
import {
  asDrawerMask,
  type DrawerMaskProps,
  type DrawerMaskExposes,
} from '@proto.ui/prototypes-base/drawer';

export default definePrototype<DrawerMaskProps, DrawerMaskExposes>({
  name: 'liquid-glass-drawer-mask',
  setup(def) {
    const behavior = asDrawerMask();
    // Soft backdrop dimming preserves underlying vibrancy behind the translucent sheet.
    def.feedback.style.use(tw('fixed inset-0 bg-black/30'));
    behavior.asTransition.configure({
      enterDuration: 240,
      leaveDuration: 200,
      completion: { kind: 'presentation', timeoutMs: 600 },
    });
    def.feedback.style.presence({
      owner: behavior.asTransition.presentationOwner,
      closed: { opacity: 0 },
      entered: { opacity: 1 },
      easing: [0.22, 1, 0.36, 1],
    });
  },
});
