import { definePrototype } from '@proto.ui/core';
import { asAutocompleteInput } from '@proto.ui/prototypes-base/autocomplete';
import type { AutocompleteInputProps, AutocompleteInputExposes } from './types';
import { setupSearchInputPaint } from '../combobox/visual';
export default definePrototype<AutocompleteInputProps, AutocompleteInputExposes>({
  name: 'shadcn-autocomplete-input',
  modules: asAutocompleteInput.modules,
  setup(def) {
    const behavior = asAutocompleteInput();
    setupSearchInputPaint(def, {
      disabled: behavior.getState!('disabled')!,
      focusVisible: behavior.getState!('focusVisible')!,
    });
    return () => null;
  },
});
