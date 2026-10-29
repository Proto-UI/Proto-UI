import { definePrototype, tw } from '@proto.ui/core';
import {
  asAlertDialogCancel,
  type AlertDialogCancelExposes,
} from '@proto.ui/prototypes-base/alert-dialog';

import type { ShadcnAlertDialogCancelProps } from './types';
import { setupPassiveOverlayAction } from '../dialog/action-paint';

// Passive family Button paint; the inherited AlertDialog command keeps sole action ownership.
// Keep the valid borrowed getState pattern. Source collector coverage is a separate owner.
export default definePrototype<ShadcnAlertDialogCancelProps, AlertDialogCancelExposes>({
  name: 'shadcn-alert-dialog-cancel',
  setup(def) {
    const behavior = asAlertDialogCancel();
    const state = behavior.getState!;
    def.feedback.style.use(tw('select-none'));
    setupPassiveOverlayAction(
      def,
      {
        hovered: state('hovered')!,
        focusVisible: state('focusVisible')!,
        disabled: state('disabled')!,
        pressed: state('pressed')!,
      },
      'outline'
    );
  },
});
