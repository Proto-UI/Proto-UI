import { definePrototype } from '@proto.ui/core';
import { asDialogTitle } from '@proto.ui/prototypes-base/dialog';
import type { ShadcnDialogTitleExposes, ShadcnDialogTitleProps } from './types';
import { setupOverlayPaint } from './style';
import { DIALOG_TITLE } from './recipes';

const dialogTitle = definePrototype<ShadcnDialogTitleProps, ShadcnDialogTitleExposes>({
  name: 'shadcn-dialog-title',
  setup(def) {
    // P-SHADCN-DIALOG-TITLE-BASE-INHERITANCE,
    // P-SHADCN-DIALOG-TITLE-CURRENT-VISUAL-SURFACE
    asDialogTitle();
    setupOverlayPaint(def, DIALOG_TITLE);
  },
});

/** P-SHADCN-DIALOG-TITLE-DIRECT-ENTRY; parity is bounded by P-SHADCN-DIALOG-TITLE-COMPATIBILITY-SUBSET. */

export default dialogTitle;
