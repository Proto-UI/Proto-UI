import { definePrototype } from '@proto.ui/core';
import { asMenubarTrigger } from '@proto.ui/prototypes-base/menubar';
import type { MenubarTriggerProps, MenubarTriggerExposes } from './types';
import { setupMenubarTriggerPaint } from './visual';
export default definePrototype<MenubarTriggerProps, MenubarTriggerExposes>({
  name: 'shadcn-menubar-trigger',
  modules: asMenubarTrigger.modules,
  setup(def) {
    const behavior = asMenubarTrigger();
    setupMenubarTriggerPaint(def, {
      disabled: behavior.getState!('disabled')!,
      focused: behavior.getState!('focused')!,
      expanded: behavior.getState!('expanded')!,
    });
  },
});
