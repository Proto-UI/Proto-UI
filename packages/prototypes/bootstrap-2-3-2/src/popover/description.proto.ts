import { definePrototype, tw } from '@proto.ui/core';
import {
  asPopoverDescription,
  type PopoverDescriptionProps,
  type PopoverDescriptionExposes,
} from '@proto.ui/prototypes-base/popover';

export default definePrototype<PopoverDescriptionProps, PopoverDescriptionExposes>({
  name: 'bootstrap-2-3-2-popover-description',
  modules: asPopoverDescription.modules,
  setup(def) {
    const behavior = asPopoverDescription();
    // Body copy maps to .popover-content; Title keeps its independent inset.
    def.feedback.style.use(tw('px-[14px] py-[9px] text-[14px] leading-[20px] text-foreground'));
    return behavior.render;
  },
});
