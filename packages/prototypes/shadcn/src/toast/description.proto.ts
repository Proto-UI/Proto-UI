import { definePrototype } from '@proto.ui/core';
import { asToastDescription, type ToastDescriptionExposes } from '@proto.ui/prototypes-base/toast';
import type { ToastDescriptionProps } from './types';
import { setupOverlayPaint } from '../dialog/style';
import { TOAST_DESCRIPTION_RECIPES } from './recipes';

export default definePrototype<ToastDescriptionProps, ToastDescriptionExposes>({
  name: 'shadcn-toast-description',
  setup(def) {
    const behavior = asToastDescription();
    setupOverlayPaint(def, TOAST_DESCRIPTION_RECIPES);
    return behavior.render;
  },
});
