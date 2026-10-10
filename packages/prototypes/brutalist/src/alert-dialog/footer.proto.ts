import { definePrototype, tw } from '@proto.ui/core';
import { ALERT_DIALOG_FAMILY } from '@proto.ui/prototypes-base/alert-dialog';
import type { BrutalistAlertDialogFooterExposes, BrutalistAlertDialogFooterProps } from './types';

/** Source: neobrutalism-components 3306a802; see THIRD_PARTY_NOTICES.md. */
export default definePrototype<BrutalistAlertDialogFooterProps, BrutalistAlertDialogFooterExposes>({
  name: 'brutalist-alert-dialog-footer',
  setup(def) {
    // P-BRUTALIST-ALERT-DIALOG-FOOTER-PASSIVE: descendant commands keep their owners.
    def.anatomy.claim(ALERT_DIALOG_FAMILY, { role: 'footer' });
    // P-BRUTALIST-ALERT-DIALOG-FOOTER-LAYOUT: intrinsic reverse wrapping is not
    // upstream's 640px full-width column switch. Author-side sm: is unavailable.
    def.feedback.style.use(tw('flex min-w-0 flex-wrap-reverse gap-3 items-center justify-end'));
    return (renderer) => renderer.r.slot();
  },
});
