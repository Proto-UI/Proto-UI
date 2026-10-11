import { definePrototype, tw } from '@proto.ui/core';
import {
  asToastDescription,
  type ToastDescriptionProps,
  type ToastDescriptionExposes,
} from '@proto.ui/prototypes-base/toast';

export default definePrototype<ToastDescriptionProps, ToastDescriptionExposes>({
  name: 'shadcn-toast-description',
  setup(def) {
    const behavior = asToastDescription();
    def.feedback.style.use(tw('text-sm text-muted-foreground'));
  },
});
