import { definePrototype, tw } from '@proto.ui/core';
import { asToastTitle, type ToastTitleExposes } from '@proto.ui/prototypes-base/toast';
import type { ToastTitleProps } from './types';
import { setupOverlayStyle } from '../dialog/style';

export default definePrototype<ToastTitleProps, ToastTitleExposes>({
  name: 'shadcn-toast-title',
  setup(def) {
    const behavior = asToastTitle();
    setupOverlayStyle(def);
    // Existing Proto part typography: the selected shadcn source has no Title recipe.
    def.feedback.style.use(tw('font-semibold'));
  },
});
