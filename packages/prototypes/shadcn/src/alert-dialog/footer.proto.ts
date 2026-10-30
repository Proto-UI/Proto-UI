import { definePrototype, tw } from '@proto.ui/core';
import { ALERT_DIALOG_FAMILY } from '@proto.ui/prototypes-base/alert-dialog';
import type { ShadcnAlertDialogFooterProps, ShadcnAlertDialogFooterExposes } from './types';
import { setupOverlayPaint } from '../dialog/style';
import { ALERT_FOOTER } from './recipes';

/** New York 02cad611 grouping; responsive breakpoint parity remains open. */
export default definePrototype<ShadcnAlertDialogFooterProps, ShadcnAlertDialogFooterExposes>({
  name: 'shadcn-alert-dialog-footer',
  setup(def) {
    def.anatomy.claim(ALERT_DIALOG_FAMILY, { role: 'footer' });
    def.feedback.style.use(tw('flex min-w-0 flex-wrap-reverse items-center justify-end'));
    setupOverlayPaint(def, ALERT_FOOTER);
    return (renderer) => renderer.r.slot();
  },
});
