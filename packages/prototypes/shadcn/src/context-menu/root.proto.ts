import { definePrototype, tw } from '@proto.ui/core';
import {
  asContextMenuRoot,
  type ContextMenuRootProps,
  type ContextMenuRootExposes,
} from '@proto.ui/prototypes-base/context-menu';
export default definePrototype<ContextMenuRootProps, ContextMenuRootExposes>({
  name: 'shadcn-context-menu-root',
  setup(def) {
    const behavior = asContextMenuRoot();
    def.feedback.style.use(tw('relative flex min-w-0 flex-wrap items-center gap-1'));
  },
});
