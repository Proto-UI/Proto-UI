import { definePrototype } from '@proto.ui/core';
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
    setupOverlayMask(def);
    behavior.asTransition.configure({ enterDuration: 0, leaveDuration: 0 });
  },
});
