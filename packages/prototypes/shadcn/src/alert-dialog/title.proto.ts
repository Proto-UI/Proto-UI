import { definePrototype } from '@proto.ui/core';
import {
  asAlertDialogTitle,
  type AlertDialogTitleExposes,
} from '@proto.ui/prototypes-base/alert-dialog';
import type { AlertDialogTitleProps } from './types';
import { setupOverlayPaint } from '../dialog/style';
import { ALERT_TITLE } from './recipes';

export default definePrototype<AlertDialogTitleProps, AlertDialogTitleExposes>({
  name: 'shadcn-alert-dialog-title',
  setup(def) {
    const behavior = asAlertDialogTitle();
    setupOverlayPaint(def, ALERT_TITLE);
  },
});
