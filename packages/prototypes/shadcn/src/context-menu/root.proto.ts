import { definePrototype } from '@proto.ui/core';
import { asContextMenuRoot } from '@proto.ui/prototypes-base/context-menu';
import type { ContextMenuRootProps, ContextMenuRootExposes } from './types';
import { setupShadcnStyleScope } from '../style-scope';
export default definePrototype<ContextMenuRootProps, ContextMenuRootExposes>({
  name: 'shadcn-context-menu-root',
  modules: asContextMenuRoot.modules,
  setup(def) {
    asContextMenuRoot();
    setupShadcnStyleScope(def);
  },
});
