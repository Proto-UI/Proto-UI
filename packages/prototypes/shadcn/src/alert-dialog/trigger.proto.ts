import { definePrototype, tw } from '@proto.ui/core';
import {
  asAlertDialogTrigger,
  type AlertDialogTriggerExposes,
} from '@proto.ui/prototypes-base/alert-dialog';
import type { AlertDialogTriggerProps } from './types';
import { setupAlertDialogButtonPaint } from './action-paint';

// Passive family Button paint; the inherited AlertDialog command keeps sole trigger ownership.
export default definePrototype<AlertDialogTriggerProps, AlertDialogTriggerExposes>({
  name: 'shadcn-alert-dialog-trigger',
  setup(def) {
    const behavior = asAlertDialogTrigger();
    const state = behavior.getState!;
    def.feedback.style.use(tw('select-none'));
    setupAlertDialogButtonPaint(
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
