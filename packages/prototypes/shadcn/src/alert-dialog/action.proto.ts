import { definePrototype, tw } from '@proto.ui/core';
import {
  asAlertDialogAction,
  type AlertDialogActionExposes,
} from '@proto.ui/prototypes-base/alert-dialog';

import type { ShadcnAlertDialogActionProps } from './types';
import { setupPassiveOverlayAction } from '../dialog/action-paint';

// Passive family Button paint; the inherited AlertDialog command keeps sole action ownership.
// Keep the valid borrowed getState pattern. Source collector coverage is a separate owner.
export default definePrototype<ShadcnAlertDialogActionProps, AlertDialogActionExposes>({
  name: 'shadcn-alert-dialog-action',
  setup(def) {
    const behavior = asAlertDialogAction();
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
      'default'
    );
  },
});
