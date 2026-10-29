import { definePrototype } from '@proto.ui/core';
import { asDrawerMask, type DrawerMaskExposes } from '@proto.ui/prototypes-base/drawer';
import type { DrawerMaskProps } from './types';
import { setupOverlayMask } from '../dialog/style';

export default definePrototype<DrawerMaskProps, DrawerMaskExposes>({
  name: 'shadcn-drawer-mask',
  setup(def) {
    const behavior = asDrawerMask();
    setupOverlayMask(def);
    behavior.asTransition.configure({
      enterDuration: 500,
      leaveDuration: 500,
      completion: { kind: 'presentation', timeoutMs: 1000 },
    });
    def.feedback.style.presence({
      owner: behavior.asTransition.presentationOwner,
      closed: { opacity: 0 },
      entered: { opacity: 1 },
      easing: [0.32, 0.72, 0, 1],
    });
  },
});
