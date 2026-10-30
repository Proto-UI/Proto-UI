import { definePrototype, tw } from '@proto.ui/core';
import {
  asDialogMask,
  type DialogMaskProps,
  type DialogMaskExposes,
} from '@proto.ui/prototypes-base/dialog';

export type CommandDialogMaskProps = Required<
  Pick<DialogMaskProps, 'enterDuration' | 'leaveDuration'>
>;

/** Search composition's unpainted modal layer, not ordinary Dialog overlay.
 * MIT source: shadcn/ui3d98900e apps/v4/components/command-menu.tsx omits
 * DialogOverlay while Radix Dialog still supplies modality. Proto UI's modal
 * blocker belongs to Mask, so keep that semantic part without visible paint.
 * Explicit durations come from the same consumer profile as Content.
 */
export default definePrototype<CommandDialogMaskProps, DialogMaskExposes>({
  name: 'shadcn-command-dialog-mask',
  setup(def) {
    // P-SHADCN-COMMAND-DIALOG-MASK: no query/open owner or page-level backdrop.
    const dialog = asDialogMask();
    dialog.asTransition.configure({ enterDuration: 200, leaveDuration: 200 });
    def.feedback.style.use(tw('fixed inset-0 bg-transparent'));
  },
});
