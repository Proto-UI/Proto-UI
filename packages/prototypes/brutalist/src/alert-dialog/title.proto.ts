import { definePrototype, tw } from '@proto.ui/core';
import {
  asAlertDialogTitle,
  type AlertDialogTitleProps,
  type AlertDialogTitleExposes,
} from '@proto.ui/prototypes-base/alert-dialog';

export default definePrototype<AlertDialogTitleProps, AlertDialogTitleExposes>({
  name: 'brutalist-alert-dialog-title',
  setup(def) {
    const behavior = asAlertDialogTitle();
    // AlertDialog's upstream heading is 18px/28px; ordinary Dialog uses another recipe.
    def.feedback.style.use(tw('font-heading font-bold text-lg text-foreground'));
  },
});
