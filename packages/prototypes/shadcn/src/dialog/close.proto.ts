import { definePrototype } from '@proto.ui/core';
import { asDialogClose } from '@proto.ui/prototypes-base/dialog';
import type { ShadcnDialogCloseExposes, ShadcnDialogCloseProps } from './types';

const dialogClose = definePrototype<ShadcnDialogCloseProps, ShadcnDialogCloseExposes>({
  name: 'shadcn-dialog-close',
  setup() {
    // P-SHADCN-DIALOG-CLOSE-BASE-INHERITANCE,
    // P-SHADCN-DIALOG-CLOSE-CURRENT-BASE-DEVIATIONS
    asDialogClose();
    // P-SHADCN-DIALOG-CLOSE-UNSTYLED-SURFACE: consumers own layout bounds.
  },
});

/** P-SHADCN-DIALOG-CLOSE-DIRECT-ENTRY and P-SHADCN-DIALOG-CLOSE-STATE-DRIVEN-STYLES. */

export default dialogClose;
