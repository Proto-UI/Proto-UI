import { definePrototype } from '@proto.ui/core';
import { asMenubarRoot } from '@proto.ui/prototypes-base/menubar';
import type { MenubarRootProps, MenubarRootExposes } from './types';
import { setupMenubarRootPaint } from './visual';
export default definePrototype<MenubarRootProps, MenubarRootExposes>({
  name: 'shadcn-menubar-root',
  modules: asMenubarRoot.modules,
  setup(def) {
    asMenubarRoot();
    setupMenubarRootPaint(def);
  },
});
