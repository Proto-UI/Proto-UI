import { definePrototype, tw } from '@proto.ui/core';
import {
  asContextMenuRoot,
  type ContextMenuRootProps,
  type ContextMenuRootExposes,
} from '@proto.ui/prototypes-base/context-menu';
export default definePrototype<ContextMenuRootProps, ContextMenuRootExposes>({
  name: 'bootstrap-2-3-2-context-menu-root',
  modules: asContextMenuRoot.modules,
  setup(def) {
    const behavior = asContextMenuRoot();
    def.feedback.style.use(tw('relative inline-block min-w-0'));
    return behavior.render;
  },
});
