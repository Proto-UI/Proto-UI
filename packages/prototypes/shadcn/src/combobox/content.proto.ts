import { definePrototype } from '@proto.ui/core';
import { asComboboxContent } from '@proto.ui/prototypes-base/combobox';
import type { ComboboxContentProps, ComboboxContentExposes } from './types';
import { setupSearchContentPaint } from './visual';
export default definePrototype<ComboboxContentProps, ComboboxContentExposes>({
  name: 'shadcn-combobox-content',
  modules: asComboboxContent.modules,
  setup(def) {
    const behavior = asComboboxContent();
    setupSearchContentPaint(def, behavior.getState!('open')!);
  },
});
