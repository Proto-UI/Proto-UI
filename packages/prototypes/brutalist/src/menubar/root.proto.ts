import { definePrototype, tw } from '@proto.ui/core';
import {
  asMenubarRoot,
  type MenubarRootProps,
  type MenubarRootExposes,
} from '@proto.ui/prototypes-base/menubar';
export default definePrototype<MenubarRootProps, MenubarRootExposes>({
  name: 'brutalist-menubar-root',
  setup(def) {
    const behavior = asMenubarRoot();
    def.feedback.style.use(tw('relative flex min-w-0 flex-wrap items-center gap-1'));
  },
});
