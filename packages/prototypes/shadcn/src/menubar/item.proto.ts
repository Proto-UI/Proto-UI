import { definePrototype } from '@proto.ui/core';
import { asMenubarItem } from '@proto.ui/prototypes-base/menubar';
import type { MenubarItemProps, MenubarItemExposes } from './types';
import { setupMenuItemPaint } from '../dropdown/visual';
export default definePrototype<MenubarItemProps, MenubarItemExposes>({
  name: 'shadcn-menubar-item',
  modules: asMenubarItem.modules,
  setup(def) {
    const behavior = asMenubarItem();
    setupMenuItemPaint(
      def,
      {
        disabled: behavior.getState!('disabled')!,
        focused: behavior.getState!('focused')!,
        focusVisible: behavior.getState!('focusVisible')!,
      },
      'menubar'
    );
  },
});
