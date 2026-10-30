import { definePrototype, tw } from '@proto.ui/core';
import {
  asMenubarRoot,
  type MenubarRootProps,
  type MenubarRootExposes,
} from '@proto.ui/prototypes-base/menubar';
export default definePrototype<MenubarRootProps, MenubarRootExposes>({
  name: 'bootstrap-2-3-2-menubar-root',
  modules: asMenubarRoot.modules,
  setup(def) {
    const behavior = asMenubarRoot();
    def.feedback.style.use(tw('relative flex min-w-0 flex-wrap items-start mb-[20px]'));
    return behavior.render;
  },
});
