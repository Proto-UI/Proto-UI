import { definePrototype, tw } from '@proto.ui/core';
import { ALERT_DIALOG_FAMILY } from '@proto.ui/prototypes-base/alert-dialog';
import type { BrutalistAlertDialogHeaderExposes, BrutalistAlertDialogHeaderProps } from './types';

/** Source: neobrutalism-components 3306a802; see THIRD_PARTY_NOTICES.md. */
export default definePrototype<BrutalistAlertDialogHeaderProps, BrutalistAlertDialogHeaderExposes>({
  name: 'brutalist-alert-dialog-header',
  setup(def) {
    // P-BRUTALIST-ALERT-DIALOG-HEADER-PASSIVE: no Base behavior or second state owner.
    def.anatomy.claim(ALERT_DIALOG_FAMILY, { role: 'header' });
    // P-BRUTALIST-ALERT-DIALOG-HEADER-LAYOUT: bounded desktop recipe, not sm: parity.
    def.feedback.style.use(tw('flex min-w-0 flex-col gap-2 text-left'));
    return (renderer) => renderer.r.slot();
  },
});
