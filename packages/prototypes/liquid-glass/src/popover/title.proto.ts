import { definePrototype, tw } from '@proto.ui/core';
import {
  asPopoverTitle,
  type PopoverTitleProps,
  type PopoverTitleExposes,
} from '@proto.ui/prototypes-base/popover';

export default definePrototype<PopoverTitleProps, PopoverTitleExposes>({
  name: 'liquid-glass-popover-title',
  setup(def) {
    const behavior = asPopoverTitle();
    def.feedback.style.use(tw('text-lg font-semibold'));
  },
});
