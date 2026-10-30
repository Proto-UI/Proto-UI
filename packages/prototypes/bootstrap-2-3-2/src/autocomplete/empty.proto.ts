import { definePrototype, tw } from '@proto.ui/core';
import {
  asAutocompleteEmpty,
  type AutocompleteEmptyProps,
  type AutocompleteEmptyExposes,
} from '@proto.ui/prototypes-base/autocomplete';
export default definePrototype<AutocompleteEmptyProps, AutocompleteEmptyExposes>({
  name: 'bootstrap-2-3-2-autocomplete-empty',
  modules: asAutocompleteEmpty.modules,
  setup(def) {
    const behavior = asAutocompleteEmpty();
    def.feedback.style.use(tw('px-[20px] py-[3px] text-[14px] leading-[20px] text-[#999]'));
    return behavior.render;
  },
});
