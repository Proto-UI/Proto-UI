import { definePrototype, tw } from '@proto.ui/core';
import {
  asDialogRoot,
  type DialogRootProps,
  type DialogRootExposes,
} from '@proto.ui/prototypes-base/dialog';

export default definePrototype<DialogRootProps, DialogRootExposes>({
  name: 'liquid-glass-dialog-root',
  setup(def) {
    const behavior = asDialogRoot();
    def.feedback.style.use(tw('relative inline-flex min-w-0'));
  },
});
