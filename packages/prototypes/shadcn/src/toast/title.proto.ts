import { definePrototype } from '@proto.ui/core';
import { asToastTitle, type ToastTitleExposes } from '@proto.ui/prototypes-base/toast';
import type { ToastTitleProps } from './types';
import { setupOverlayPaint } from '../dialog/style';
import { TOAST_TITLE_RECIPES } from './recipes';

export default definePrototype<ToastTitleProps, ToastTitleExposes>({
  name: 'shadcn-toast-title',
  setup(def) {
    const behavior = asToastTitle();
    setupOverlayPaint(def, TOAST_TITLE_RECIPES);
    return behavior.render;
  },
});
