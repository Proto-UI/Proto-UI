import { definePrototype, tw } from '@proto.ui/core';
import { asDialogMask } from '@proto.ui/prototypes-base/dialog';
import type { BrutalistDialogMaskExposes, BrutalistDialogMaskProps } from './types';

const dialogMask = definePrototype<BrutalistDialogMaskProps, BrutalistDialogMaskExposes>({
  name: 'brutalist-dialog-mask',
  setup(def) {
    // P-BRUTALIST-DIALOG-MASK-BASE-INHERITANCE: inherit internal open/transition ownership once.
    // P-BRUTALIST-DIALOG-MASK-PUBLIC-BOUNDARY: TypeScript boundary keeps passthrough plus transitionState/isPresent.
    const dialog = asDialogMask();
    // P-BRUTALIST-DIALOG-MASK-TRANSITION
    dialog.asTransition.configure({ enterDuration: 150, leaveDuration: 150 });
    const dialogState = dialog.stateHandles;
    const { open } = dialogState;
    // P-BRUTALIST-DIALOG-MASK-VISUAL-GRAMMAR: fixed inset-0 bg-overlay flat scrim (no blur, no border, no shadow).
    def.feedback.style.use(tw('fixed inset-0 bg-overlay'));

    def.rule({
      when: (w) => w.state(open).eq(true),
      intent: (i) => i.feedback.style.use(tw('animate-in fade-in-0')),
    });

    def.rule({
      when: (w) => w.state(open).eq(false),
      intent: (i) => i.feedback.style.use(tw('animate-out fade-out-0')),
    });
  },
});

/** P-BRUTALIST-DIALOG-MASK-ENTRY: `brutalist-dialog-mask` is the only public Dialog mask entry in this slice. */

export default dialogMask;
