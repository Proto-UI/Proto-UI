import { definePrototype, tw } from '@proto.ui/core';
import {
  asPopoverRoot,
  type PopoverRootProps,
  type PopoverRootExposes,
} from '@proto.ui/prototypes-base/popover';

export default definePrototype<PopoverRootProps, PopoverRootExposes>({
  name: 'liquid-glass-popover-root',
  setup(def) {
    const behavior = asPopoverRoot();
    def.feedback.style.use(tw('relative inline-flex min-w-0'));
  },
});
