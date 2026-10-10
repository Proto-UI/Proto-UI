import { definePrototype, tw } from '@proto.ui/core';
import {
  asAlertDialogTitle,
  type AlertDialogTitleProps,
  type AlertDialogTitleExposes,
} from '@proto.ui/prototypes-base/alert-dialog';

export default definePrototype<AlertDialogTitleProps, AlertDialogTitleExposes>({
  name: 'bootstrap-2-3-2-alert-dialog-title',
  setup(def) {
    const behavior = asAlertDialogTitle();
    def.feedback.style.use(tw('text-xl font-bold'));
  },
});
