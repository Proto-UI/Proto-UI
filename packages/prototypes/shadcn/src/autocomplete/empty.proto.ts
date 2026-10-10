import { definePrototype, tw } from '@proto.ui/core';
import {
  asAutocompleteEmpty,
  type AutocompleteEmptyProps,
  type AutocompleteEmptyExposes,
} from '@proto.ui/prototypes-base/autocomplete';
export default definePrototype<AutocompleteEmptyProps, AutocompleteEmptyExposes>({
  name: 'shadcn-autocomplete-empty',
  setup(def) {
    const behavior = asAutocompleteEmpty();
    def.feedback.style.use(tw('px-3 py-6 text-center text-sm text-muted-foreground'));
  },
});
