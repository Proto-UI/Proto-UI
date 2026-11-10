import { definePrototype } from '@proto.ui/core';
import {
  asDialogClose,
  type DialogCloseProps,
  type DialogCloseExposes,
} from '@proto.ui/prototypes-base/dialog';

// A command wrapper for an authored family Button, not Bootstrap's .close icon.
// Applying the icon's opacity here also fades every nested action. CloseIcon owns
// that separate presentation; Base retains sole ownership of the close request.
export default definePrototype<DialogCloseProps, DialogCloseExposes>({
  name: 'bootstrap-2-3-2-dialog-close',
  setup() {
    asDialogClose();
  },
});
