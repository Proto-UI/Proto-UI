import { definePrototype } from '@proto.ui/core';
import { asDialogClose } from '@proto.ui/prototypes-base/dialog';
import type { BrutalistDialogCloseExposes, BrutalistDialogCloseProps } from './types';

const dialogClose = definePrototype<BrutalistDialogCloseProps, BrutalistDialogCloseExposes>({
  name: 'brutalist-dialog-close',
  setup() {
    // P-BRUTALIST-DIALOG-CLOSE-BASE-INHERITANCE: inherit Base Dialog Close (close/disabled states) once.
    asDialogClose();
  },
});

/** P-BRUTALIST-DIALOG-CLOSE-ENTRY: `brutalist-dialog-close` is the only public Dialog close entry in this slice. */

export default dialogClose;
