import { definePrototype, tw } from '@proto.ui/core';
import {
  asAlertDialogMask,
  type AlertDialogMaskExposes,
} from '@proto.ui/prototypes-base/alert-dialog';
import type { AlertDialogMaskProps } from './types';
import { setupOverlayMask } from '../dialog/style';

export default definePrototype<AlertDialogMaskProps, AlertDialogMaskExposes>({
  name: 'shadcn-alert-dialog-mask',
  setup(def) {
    const behavior = asAlertDialogMask();
    const style = setupOverlayMask(def);
    const { open } = behavior.stateHandles;
    def.rule({
      when: (w) => w.not(w.state(style).eq('new-york-v4')),
      intent: (i) => i.feedback.style.use(tw('duration-100')),
    });
    def.rule({
      when: (w) => w.state(open).eq(true),
      intent: (i) => i.feedback.style.use(tw('animate-in fade-in-0')),
    });
    def.rule({
      when: (w) => w.state(open).eq(false),
      intent: (i) => i.feedback.style.use(tw('animate-out fade-out-0')),
    });
    behavior.asTransition.configure({ enterDuration: 0, leaveDuration: 0 });
  },
});
