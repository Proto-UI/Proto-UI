import { definePrototype, tw } from '@proto.ui/core';
import {
  asToastRoot,
  type ToastRootProps,
  type ToastRootExposes,
} from '@proto.ui/prototypes-base/toast';

export default definePrototype<ToastRootProps, ToastRootExposes>({
  name: 'bootstrap-2-3-2-toast-root',
  modules: asToastRoot.modules,
  setup(def) {
    const behavior = asToastRoot();
    // Toast is a Proto extension, not a Bootstrap plugin. Use the pinned
    // .alert warning recipe without taking its queue, pause or open ownership.
    def.feedback.style.use(
      tw(
        'min-w-0 w-full rounded-[4px] border border-[#fbeed5] bg-[#fcf8e3] pl-[14px] pr-[35px] py-[8px] mb-[20px] font-sans text-[14px] leading-[20px] text-paint-[#c09853_0_1px_0_rgb(255_255_255/50%)]'
      )
    );
    return behavior.render;
  },
});
