import { definePrototype, tw } from '@proto.ui/core';
import {
  asToastDescription,
  type ToastDescriptionProps,
  type ToastDescriptionExposes,
} from '@proto.ui/prototypes-base/toast';

export default definePrototype<ToastDescriptionProps, ToastDescriptionExposes>({
  name: 'bootstrap-2-3-2-toast-description',
  modules: asToastDescription.modules,
  setup(def) {
    const behavior = asToastDescription();
    def.feedback.style.use(tw('text-[14px] leading-[20px] text-inherit'));
    return behavior.render;
  },
});
