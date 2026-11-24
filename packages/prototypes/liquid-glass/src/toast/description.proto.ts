import { definePrototype, tw } from '@proto.ui/core';
import {
  asToastDescription,
  type ToastDescriptionProps,
  type ToastDescriptionExposes,
} from '@proto.ui/prototypes-base/toast';

export default definePrototype<ToastDescriptionProps, ToastDescriptionExposes>({
  name: 'liquid-glass-toast-description',
  setup(def) {
    const behavior = asToastDescription();
    def.feedback.style.use(tw('font-sans text-sm leading-5 text-muted-foreground'));
    return behavior.render;
  },
});
