import { definePrototype, tw } from '@proto.ui/core';
import { asDialogTitle } from '@proto.ui/prototypes-base/dialog';
import type { BrutalistDialogTitleExposes, BrutalistDialogTitleProps } from './types';

const dialogTitle = definePrototype<BrutalistDialogTitleProps, BrutalistDialogTitleExposes>({
  name: 'brutalist-dialog-title',
  setup(def) {
    // P-BRUTALIST-DIALOG-TITLE-BASE-INHERITANCE: inherit Base Dialog Title relations once.
    // P-BRUTALIST-DIALOG-TITLE-VISUAL-GRAMMAR: font-bold uppercase tracking-tight text-foreground heading typography.
    asDialogTitle();
    def.feedback.style.use(tw('font-bold uppercase tracking-tight text-foreground'));
  },
});

/** P-BRUTALIST-DIALOG-TITLE-ENTRY: `brutalist-dialog-title` is the only public Dialog title entry in this slice. */

export default dialogTitle;
