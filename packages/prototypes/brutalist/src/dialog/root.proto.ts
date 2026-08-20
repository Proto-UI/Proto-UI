import { definePrototype, tw } from '@proto.ui/core';
import { asDialogRoot } from '@proto.ui/prototypes-base/dialog';
import type { BrutalistDialogRootExposes, BrutalistDialogRootProps } from './types';

const dialogRoot = definePrototype<BrutalistDialogRootProps, BrutalistDialogRootExposes>({
  name: 'brutalist-dialog-root',
  setup(def) {
    // P-BRUTALIST-DIALOG-BASE-INHERITANCE: inherit Base Dialog Root open ownership and request methods once.
    asDialogRoot();
    // P-BRUTALIST-DIALOG-VISUAL-GRAMMAR: relative inline-flex container surface (no borders/shadow itself).
    def.feedback.style.use(tw('relative inline-flex items-start'));
  },
});

/** P-BRUTALIST-DIALOG-ENTRY: `brutalist-dialog-root` is the only public Dialog root entry in this slice. */

export default dialogRoot;
