import { definePrototype, tw } from '@proto.ui/core';
import {
  asPopoverTitle,
  type PopoverTitleProps,
  type PopoverTitleExposes,
} from '@proto.ui/prototypes-base/popover';

export default definePrototype<PopoverTitleProps, PopoverTitleExposes>({
  name: 'bootstrap-2-3-2-popover-title',
  modules: asPopoverTitle.modules,
  setup(def) {
    const behavior = asPopoverTitle();
    def.feedback.style.use(
      tw(
        'm-0 px-[14px] py-[8px] text-[14px] font-normal leading-[18px] bg-[#f7f7f7] border-b border-[#ebebeb] rounded-t-[5px]'
      )
    );
    return behavior.render;
  },
});
