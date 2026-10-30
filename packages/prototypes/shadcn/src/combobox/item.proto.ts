import { definePrototype } from '@proto.ui/core';
import { asComboboxItem } from '@proto.ui/prototypes-base/combobox';
import type { ComboboxItemProps, ComboboxItemExposes } from './types';
import { setupSearchItemPaint } from './visual';
export default definePrototype<ComboboxItemProps, ComboboxItemExposes>({
  name: 'shadcn-combobox-item',
  modules: asComboboxItem.modules,
  setup(def) {
    const behavior = asComboboxItem();
    setupSearchItemPaint(def, {
      disabled: behavior.getState!('disabled')!,
      active: behavior.getState!('active')!,
    });
  },
});
