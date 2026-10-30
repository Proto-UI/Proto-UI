import { definePrototype } from '@proto.ui/core';
import { asAutocompleteItem } from '@proto.ui/prototypes-base/autocomplete';
import type { AutocompleteItemProps, AutocompleteItemExposes } from './types';
import { setupSearchItemPaint } from '../combobox/visual';
export default definePrototype<AutocompleteItemProps, AutocompleteItemExposes>({
  name: 'shadcn-autocomplete-item',
  modules: asAutocompleteItem.modules,
  setup(def) {
    const behavior = asAutocompleteItem();
    setupSearchItemPaint(def, {
      disabled: behavior.getState!('disabled')!,
      active: behavior.getState!('active')!,
    });
  },
});
