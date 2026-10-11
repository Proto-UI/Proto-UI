import { definePrototype, tw } from '@proto.ui/core';
import {
  asToastTitle,
  type ToastTitleProps,
  type ToastTitleExposes,
} from '@proto.ui/prototypes-base/toast';

export default definePrototype<ToastTitleProps, ToastTitleExposes>({
  name: 'brutalist-toast-title',
  setup(def) {
    const behavior = asToastTitle();
    def.feedback.style.use(tw('font-semibold'));
  },
});
