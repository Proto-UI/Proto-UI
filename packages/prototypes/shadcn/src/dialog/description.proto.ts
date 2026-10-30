import { definePrototype } from '@proto.ui/core';
import { asDialogDescription } from '@proto.ui/prototypes-base/dialog';
import type { ShadcnDialogDescriptionExposes, ShadcnDialogDescriptionProps } from './types';
import { setupOverlayPaint } from './style';
import { DIALOG_DESCRIPTION } from './recipes';

const dialogDescription = definePrototype<
  ShadcnDialogDescriptionProps,
  ShadcnDialogDescriptionExposes
>({
  name: 'shadcn-dialog-description',
  setup(def) {
    // P-SHADCN-DIALOG-DESCRIPTION-BASE-INHERITANCE,
    // P-SHADCN-DIALOG-DESCRIPTION-CURRENT-VISUAL-SURFACE
    asDialogDescription();
    setupOverlayPaint(def, DIALOG_DESCRIPTION);
  },
});

/** P-SHADCN-DIALOG-DESCRIPTION-DIRECT-ENTRY; parity is bounded by P-SHADCN-DIALOG-DESCRIPTION-COMPATIBILITY-SUBSET. */

export default dialogDescription;
