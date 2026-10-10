import { definePrototype, tw } from '@proto.ui/core';
import {
  asAlertDialogDescription,
  type AlertDialogDescriptionProps,
  type AlertDialogDescriptionExposes,
} from '@proto.ui/prototypes-base/alert-dialog';

export default definePrototype<AlertDialogDescriptionProps, AlertDialogDescriptionExposes>({
  name: 'brutalist-alert-dialog-description',
  setup(def) {
    const behavior = asAlertDialogDescription();
    def.feedback.style.use(tw('text-sm text-foreground'));
  },
});
