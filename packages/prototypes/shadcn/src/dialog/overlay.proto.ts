import { definePrototype, tw } from '@proto.ui/core';
import { asDialogMask } from '@proto.ui/prototypes-base/dialog';
import type { ShadcnDialogMaskExposes, ShadcnDialogMaskProps } from './types';
import { setupOverlayMask } from './style';

const dialogMask = definePrototype<ShadcnDialogMaskProps, ShadcnDialogMaskExposes>({
  name: 'shadcn-dialog-mask',
  setup(def) {
    // P-SHADCN-DIALOG-MASK-BASE-INHERITANCE,
    // P-SHADCN-DIALOG-MASK-PUBLIC-BOUNDARY-DEVIATION
    const dialog = asDialogMask();
    // P-SHADCN-DIALOG-MASK-TRANSITION
    dialog.asTransition.configure({ enterDuration: 150, leaveDuration: 150 });
    const dialogState = dialog.stateHandles;
    const { open } = dialogState;
    const style = setupOverlayMask(def, { opaqueFallback: true });
    def.rule({
      when: (w) => w.not(w.state(style).eq('new-york-v4')),
      intent: (i) => i.feedback.style.use(tw('duration-100')),
    });

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

/** P-SHADCN-DIALOG-MASK-DIRECT-ENTRY; parity is bounded by P-SHADCN-DIALOG-MASK-COMPATIBILITY-SUBSET. */

export default dialogMask;
