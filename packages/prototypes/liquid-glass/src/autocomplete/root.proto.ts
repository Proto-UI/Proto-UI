import { definePrototype, tw } from '@proto.ui/core';
import {
  asAutocompleteRoot,
  type AutocompleteRootProps,
  type AutocompleteRootExposes,
} from '@proto.ui/prototypes-base/autocomplete';

export default definePrototype<AutocompleteRootProps, AutocompleteRootExposes>({
  name: 'liquid-glass-autocomplete-root',
  modules: asAutocompleteRoot.modules,
  setup(def) {
    const behavior = asAutocompleteRoot();
    def.feedback.style.use(
      tw('relative flex min-w-0 w-full max-w-md flex-nowrap items-center gap-2')
    );
    return behavior.render;
  },
});
