import { definePrototype, tw } from '@proto.ui/core';
import { asDialogMask } from '@proto.ui/prototypes-base/dialog';
import type { ShadcnDialogMaskExposes, ShadcnDialogMaskProps } from './types';

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
    // P-SHADCN-DIALOG-MASK-CURRENT-VISUAL-SURFACE
    // The opaque surface is the safe initial/unknown/lost-source presentation.
    // Live preference and support leases may enable the existing 4px material.
    def.feedback.style.use(tw('fixed inset-0 bg-background'));
    def.rule({
      when: (w) =>
        w.all(
          w.meta('preference.reducedTransparency').eq('no-preference'),
          w.meta('preference.forcedColors').eq('none'),
          w.meta('styleSupport.backdropBlur4px').eq(true)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-black/50 backdrop-blur-xs')),
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
