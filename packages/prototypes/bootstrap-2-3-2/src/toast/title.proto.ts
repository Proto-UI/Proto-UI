import { definePrototype, tw } from '@proto.ui/core';
import {
  asToastTitle,
  type ToastTitleProps,
  type ToastTitleExposes,
} from '@proto.ui/prototypes-base/toast';

export default definePrototype<ToastTitleProps, ToastTitleExposes>({
  name: 'bootstrap-2-3-2-toast-title',
  modules: asToastTitle.modules,
  setup(def) {
    const behavior = asToastTitle();
    // .alert h4 retains the warning ink and zero margin.
    def.feedback.style.use(tw('m-0 text-[17.5px] leading-[20px] font-bold text-inherit'));
    return behavior.render;
  },
});
