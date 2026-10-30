import { definePrototype } from '@proto.ui/core';
import {
  asAlertDialogDescription,
  type AlertDialogDescriptionExposes,
} from '@proto.ui/prototypes-base/alert-dialog';
import type { AlertDialogDescriptionProps } from './types';
import { setupOverlayPaint } from '../dialog/style';
import { ALERT_DESCRIPTION } from './recipes';

export default definePrototype<AlertDialogDescriptionProps, AlertDialogDescriptionExposes>({
  name: 'shadcn-alert-dialog-description',
  setup(def) {
    const behavior = asAlertDialogDescription();
    setupOverlayPaint(def, ALERT_DESCRIPTION);
  },
});
