import { definePrototype, tw } from '@proto.ui/core';
import {
  asMenubarRoot,
  type MenubarRootProps,
  type MenubarRootExposes,
} from '@proto.ui/prototypes-base/menubar';
export default definePrototype<MenubarRootProps, MenubarRootExposes>({
  name: 'brutalist-menubar-root',
  modules: asMenubarRoot.modules,
  setup(def) {
    const behavior = asMenubarRoot();
    def.feedback.style.use(
      tw(
        'relative inline-flex min-w-0 flex-wrap items-center gap-1 rounded-base border-2 border-black bg-secondary-background p-1 font-sans font-medium text-foreground shadow-[4px_4px_0_0_#000]'
      )
    );
    return behavior.render;
  },
});
