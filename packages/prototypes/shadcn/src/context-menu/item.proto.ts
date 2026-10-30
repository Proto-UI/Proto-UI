import { definePrototype } from '@proto.ui/core';
import { asContextMenuItem } from '@proto.ui/prototypes-base/context-menu';
import type { ContextMenuItemProps, ContextMenuItemExposes } from './types';
import { setupMenuItemPaint } from '../dropdown/visual';
export default definePrototype<ContextMenuItemProps, ContextMenuItemExposes>({
  name: 'shadcn-context-menu-item',
  modules: asContextMenuItem.modules,
  setup(def) {
    const behavior = asContextMenuItem();
    setupMenuItemPaint(
      def,
      {
        disabled: behavior.getState!('disabled')!,
        focused: behavior.getState!('focused')!,
        focusVisible: behavior.getState!('focusVisible')!,
      },
      'context-menu'
    );
  },
});
