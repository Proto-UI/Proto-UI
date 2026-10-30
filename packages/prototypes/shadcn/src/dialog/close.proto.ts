import { definePrototype } from '@proto.ui/core';
import { asDialogClose } from '@proto.ui/prototypes-base/dialog';
import type { ShadcnDialogCloseExposes, ShadcnDialogCloseProps } from './types';
import { setupShadcnStyleScope } from '../style-scope';

const dialogClose = definePrototype<ShadcnDialogCloseProps, ShadcnDialogCloseExposes>({
  name: 'shadcn-dialog-close',
  setup(def) {
    // P-SHADCN-DIALOG-CLOSE-BASE-INHERITANCE,
    // P-SHADCN-DIALOG-CLOSE-CURRENT-BASE-DEVIATIONS
    asDialogClose();
    setupShadcnStyleScope(def);
    // P-SHADCN-DIALOG-CLOSE-UNSTYLED-SURFACE: consumers own layout bounds.
  },
});

/** P-SHADCN-DIALOG-CLOSE-DIRECT-ENTRY and P-SHADCN-DIALOG-CLOSE-STATE-DRIVEN-STYLES. */

export default dialogClose;
