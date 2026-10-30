import { definePrototype, tw } from '@proto.ui/core';
import {
  asDialogDescription,
  type DialogDescriptionProps,
  type DialogDescriptionExposes,
} from '@proto.ui/prototypes-base/dialog';

export default definePrototype<DialogDescriptionProps, DialogDescriptionExposes>({
  name: 'liquid-glass-dialog-description',
  setup(def) {
    const behavior = asDialogDescription();
    def.feedback.style.use(tw('text-sm text-muted-foreground'));
  },
});
