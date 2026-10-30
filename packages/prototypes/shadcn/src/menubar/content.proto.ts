import { definePrototype } from '@proto.ui/core';
import { asMenubarContent } from '@proto.ui/prototypes-base/menubar';
import type { MenubarContentProps, MenubarContentExposes } from './types';
import { setupMenuSurface, setupMenuOpenPaint } from '../dropdown/visual';
export default definePrototype<MenubarContentProps, MenubarContentExposes>({
  name: 'shadcn-menubar-content',
  modules: asMenubarContent.modules,
  setup(def) {
    const behavior = asMenubarContent();
    setupMenuSurface(def, 'menubar');
    setupMenuOpenPaint(def, behavior.getState!('open')!, false);
  },
});
