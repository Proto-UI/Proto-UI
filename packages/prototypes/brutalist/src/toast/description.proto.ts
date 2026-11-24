import { definePrototype, tw } from '@proto.ui/core';
import {
  asToastDescription,
  type ToastDescriptionProps,
  type ToastDescriptionExposes,
} from '@proto.ui/prototypes-base/toast';

export default definePrototype<ToastDescriptionProps, ToastDescriptionExposes>({
  name: 'brutalist-toast-description',
  modules: asToastDescription.modules,
  setup(def) {
    const behavior = asToastDescription();
    def.feedback.style.use(tw('font-sans font-medium text-sm leading-5 text-current opacity-80'));
    return behavior.render;
  },
});
