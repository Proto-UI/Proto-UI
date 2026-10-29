import { definePrototype } from '@proto.ui/core';
import { asContextMenuContent } from '@proto.ui/prototypes-base/context-menu';
import type { ContextMenuContentProps, ContextMenuContentExposes } from './types';
import { setupMenuSurface, setupMenuOpenPaint } from '../dropdown/visual';
export default definePrototype<ContextMenuContentProps, ContextMenuContentExposes>({
  name: 'shadcn-context-menu-content',
  modules: asContextMenuContent.modules,
  setup(def) {
    const behavior = asContextMenuContent();
    setupMenuSurface(def, 'context-menu');
    setupMenuOpenPaint(def, behavior.getState!('open')!, true);
  },
});
