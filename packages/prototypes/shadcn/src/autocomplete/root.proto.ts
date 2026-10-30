import { definePrototype, tw } from '@proto.ui/core';
import { asAutocompleteRoot } from '@proto.ui/prototypes-base/autocomplete';
import type { AutocompleteRootProps, AutocompleteRootExposes } from './types';
import { setupShadcnStyleScope } from '../style-scope';
export default definePrototype<AutocompleteRootProps, AutocompleteRootExposes>({
  name: 'shadcn-autocomplete-root',
  modules: asAutocompleteRoot.modules,
  setup(def) {
    asAutocompleteRoot();
    setupShadcnStyleScope(def);
    // Proto layout composition; the source inventory has no Autocomplete Root.
    def.feedback.style.use(tw('relative flex min-w-0 w-full max-w-md flex-wrap gap-2'));
  },
});
