import { definePrototype, tw } from '@proto.ui/core';
import {
  asPopoverRoot,
  type PopoverRootProps,
  type PopoverRootExposes,
} from '@proto.ui/prototypes-base/popover';

export default definePrototype<PopoverRootProps, PopoverRootExposes>({
  name: 'bootstrap-2-3-2-popover-root',
  setup(def) {
    const behavior = asPopoverRoot();
    def.feedback.style.use(tw('relative inline-flex min-w-0'));
  },
});
