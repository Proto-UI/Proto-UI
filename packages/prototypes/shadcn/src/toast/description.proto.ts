import { definePrototype, tw } from '@proto.ui/core';
import { asToastDescription, type ToastDescriptionExposes } from '@proto.ui/prototypes-base/toast';
import type { ToastDescriptionProps } from './types';
import { setupOverlayStyle } from '../dialog/style';

export default definePrototype<ToastDescriptionProps, ToastDescriptionExposes>({
  name: 'shadcn-toast-description',
  setup(def) {
    const behavior = asToastDescription();
    setupOverlayStyle(def);
    // Existing Proto part typography, not an invented .cn-toast-description selector.
    def.feedback.style.use(tw('text-sm text-muted-foreground'));
  },
});
