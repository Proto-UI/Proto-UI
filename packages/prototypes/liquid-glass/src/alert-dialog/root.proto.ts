import { definePrototype, tw } from '@proto.ui/core';
import {
  asAlertDialogRoot,
  type AlertDialogRootProps,
  type AlertDialogRootExposes,
} from '@proto.ui/prototypes-base/alert-dialog';

export default definePrototype<AlertDialogRootProps, AlertDialogRootExposes>({
  name: 'liquid-glass-alert-dialog-root',
  setup(def) {
    const behavior = asAlertDialogRoot();
    def.feedback.style.use(tw('relative inline-flex min-w-0'));
  },
});
