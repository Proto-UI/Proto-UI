import { definePrototype } from '@proto.ui/core';
import {
  asPopoverRoot,
  type PopoverRootProps,
  type PopoverRootExposes,
} from '@proto.ui/prototypes-base/popover';

export default definePrototype<PopoverRootProps, PopoverRootExposes>({
  name: 'bootstrap-2-3-2-popover-root',
  modules: asPopoverRoot.modules,
  setup() {
    // Semantic provider only; anchored surface paint belongs to Content.
    return asPopoverRoot().render;
  },
});
