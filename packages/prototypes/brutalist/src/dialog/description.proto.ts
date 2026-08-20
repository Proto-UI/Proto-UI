import { definePrototype, tw } from '@proto.ui/core';
import { asDialogDescription } from '@proto.ui/prototypes-base/dialog';
import type { BrutalistDialogDescriptionExposes, BrutalistDialogDescriptionProps } from './types';

const dialogDescription = definePrototype<
  BrutalistDialogDescriptionProps,
  BrutalistDialogDescriptionExposes
>({
  name: 'brutalist-dialog-description',
  setup(def) {
    // P-BRUTALIST-DIALOG-DESCRIPTION-BASE-INHERITANCE: inherit Base Dialog Description relations once.
    // P-BRUTALIST-DIALOG-DESCRIPTION-VISUAL-GRAMMAR: font-mono text-sm text-foreground description typography.
    asDialogDescription();
    def.feedback.style.use(tw('font-mono text-sm text-foreground'));
  },
});

/** P-BRUTALIST-DIALOG-DESCRIPTION-ENTRY: `brutalist-dialog-description` is the only public Dialog description entry in this slice. */

export default dialogDescription;
