import { definePrototype, tw } from '@proto.ui/core';
import {
  asDialogRoot,
  type DialogRootProps,
  type DialogRootExposes,
} from '@proto.ui/prototypes-base/dialog';

export default definePrototype<DialogRootProps, DialogRootExposes>({
  name: 'bootstrap-2-3-2-dialog-root',
  setup(def) {
    asDialogRoot();
    def.feedback.style.use(tw('relative inline-flex min-w-0'));
  },
});
