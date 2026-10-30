import { definePrototype, tw } from '@proto.ui/core';
import {
  asTooltipRoot,
  type TooltipRootProps,
  type TooltipRootExposes,
} from '@proto.ui/prototypes-base/tooltip';

export default definePrototype<TooltipRootProps, TooltipRootExposes>({
  name: 'bootstrap-2-3-2-tooltip-root',
  setup(def) {
    asTooltipRoot();
    def.feedback.style.use(tw('relative inline-flex min-w-0'));
  },
});
