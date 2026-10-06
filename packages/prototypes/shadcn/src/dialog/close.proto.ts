import { definePrototype, tw } from '@proto.ui/core';
import { asDialogClose } from '@proto.ui/prototypes-base/dialog';
import type { ShadcnDialogCloseExposes, ShadcnDialogCloseProps } from './types';

const dialogClose = definePrototype<ShadcnDialogCloseProps, ShadcnDialogCloseExposes>({
  name: 'shadcn-dialog-close',
  setup(def) {
    // P-SHADCN-DIALOG-CLOSE-BASE-INHERITANCE,
    // P-SHADCN-DIALOG-CLOSE-CURRENT-BASE-DEVIATIONS
    asDialogClose();
    def.feedback.style.use(tw('min-w-0 max-w-full'));
  },
});

/** P-SHADCN-DIALOG-CLOSE-DIRECT-ENTRY and P-SHADCN-DIALOG-CLOSE-STATE-DRIVEN-STYLES. */

export default dialogClose;
