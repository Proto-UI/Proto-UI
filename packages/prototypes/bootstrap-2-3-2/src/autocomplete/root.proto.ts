import { definePrototype, tw } from '@proto.ui/core';
import {
  asAutocompleteRoot,
  type AutocompleteRootProps,
  type AutocompleteRootExposes,
} from '@proto.ui/prototypes-base/autocomplete';
export default definePrototype<AutocompleteRootProps, AutocompleteRootExposes>({
  name: 'bootstrap-2-3-2-autocomplete-root',
  setup(def) {
    const behavior = asAutocompleteRoot();
    def.feedback.style.use(tw('relative flex min-w-0 w-full max-w-md flex-wrap gap-2'));
  },
});
