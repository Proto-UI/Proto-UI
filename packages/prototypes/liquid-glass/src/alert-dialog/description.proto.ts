import { definePrototype, tw } from '@proto.ui/core';
import {
  asAlertDialogDescription,
  type AlertDialogDescriptionProps,
  type AlertDialogDescriptionExposes,
} from '@proto.ui/prototypes-base/alert-dialog';

export default definePrototype<AlertDialogDescriptionProps, AlertDialogDescriptionExposes>({
  name: 'liquid-glass-alert-dialog-description',
  modules: asAlertDialogDescription.modules,
  setup(def) {
    const behavior = asAlertDialogDescription();
    def.feedback.style.use(tw('text-sm leading-relaxed text-muted-foreground'));
    return behavior.render;
  },
});
