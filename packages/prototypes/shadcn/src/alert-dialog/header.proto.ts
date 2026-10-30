import { definePrototype, tw } from '@proto.ui/core';
import { ALERT_DIALOG_FAMILY } from '@proto.ui/prototypes-base/alert-dialog';
import type { ShadcnAlertDialogHeaderProps, ShadcnAlertDialogHeaderExposes } from './types';
import { setupOverlayPaint } from '../dialog/style';
import { ALERT_HEADER } from './recipes';

/** New York 02cad611 grouping; responsive breakpoint parity remains open. */
export default definePrototype<ShadcnAlertDialogHeaderProps, ShadcnAlertDialogHeaderExposes>({
  name: 'shadcn-alert-dialog-header',
  setup(def) {
    def.anatomy.claim(ALERT_DIALOG_FAMILY, { role: 'header' });
    def.feedback.style.use(tw('grid min-w-0'));
    setupOverlayPaint(def, ALERT_HEADER);
    return (renderer) => renderer.r.slot();
  },
});
