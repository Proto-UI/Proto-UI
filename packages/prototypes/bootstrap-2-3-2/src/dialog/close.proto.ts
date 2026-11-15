import { definePrototype } from '@proto.ui/core';
import {
  asDialogClose,
  type DialogCloseProps,
  type DialogCloseExposes,
} from '@proto.ui/prototypes-base/dialog';

// An unstyled command owner, distinct from Bootstrap's .close icon. Authored
// content may use passive family Surface/Text appearance, never a second Button
// owner. CloseIcon owns icon paint; Base owns focus, input and the close request.
export default definePrototype<DialogCloseProps, DialogCloseExposes>({
  name: 'bootstrap-2-3-2-dialog-close',
  setup() {
    asDialogClose();
  },
});
