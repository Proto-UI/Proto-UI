import { definePrototype } from '@proto.ui/core';
import { asComboboxEmpty } from '@proto.ui/prototypes-base/combobox';
import type { ComboboxEmptyProps, ComboboxEmptyExposes } from './types';
import { setupSearchEmptyPaint } from './visual';
export default definePrototype<ComboboxEmptyProps, ComboboxEmptyExposes>({
  name: 'shadcn-combobox-empty',
  modules: asComboboxEmpty.modules,
  setup(def) {
    const behavior = asComboboxEmpty();
    setupSearchEmptyPaint(def, behavior.getState!('visible')!);
  },
});
