import { definePrototype } from '@proto.ui/core';
import { asAutocompleteContent } from '@proto.ui/prototypes-base/autocomplete';
import type { AutocompleteContentProps, AutocompleteContentExposes } from './types';
import { setupSearchContentPaint } from '../combobox/visual';
export default definePrototype<AutocompleteContentProps, AutocompleteContentExposes>({
  name: 'shadcn-autocomplete-content',
  modules: asAutocompleteContent.modules,
  setup(def) {
    const behavior = asAutocompleteContent();
    setupSearchContentPaint(def, behavior.getState!('open')!);
  },
});
