import { definePrototype } from '@proto.ui/core';
import { asAutocompleteEmpty } from '@proto.ui/prototypes-base/autocomplete';
import type { AutocompleteEmptyProps, AutocompleteEmptyExposes } from './types';
import { setupSearchEmptyPaint } from '../combobox/visual';
export default definePrototype<AutocompleteEmptyProps, AutocompleteEmptyExposes>({
  name: 'shadcn-autocomplete-empty',
  modules: asAutocompleteEmpty.modules,
  setup(def) {
    const behavior = asAutocompleteEmpty();
    setupSearchEmptyPaint(def, behavior.getState!('visible')!);
  },
});
