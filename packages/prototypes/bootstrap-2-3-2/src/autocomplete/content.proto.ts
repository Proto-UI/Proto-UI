import { definePrototype, tw } from '@proto.ui/core';
import {
  asAutocompleteContent,
  type AutocompleteContentProps,
  type AutocompleteContentExposes,
} from '@proto.ui/prototypes-base/autocomplete';
export default definePrototype<AutocompleteContentProps, AutocompleteContentExposes>({
  name: 'bootstrap-2-3-2-autocomplete-content',
  modules: asAutocompleteContent.modules,
  setup(def) {
    const behavior = asAutocompleteContent();
    // The overlay owns geometry; 2px is the pinned .typeahead separation.
    def.props.setDefaults({ sideOffset: 2 });
    def.feedback.style.use(
      tw(
        'z-[1051] min-w-[160px] max-w-[var(--proto-ui-available-width)] max-h-[var(--proto-ui-available-height)] overflow-y-auto rounded-[4px] border border-[rgb(0_0_0/20%)] bg-background bg-clip-padding text-foreground py-[5px] shadow-[0_5px_10px_rgb(0_0_0/20%)]'
      )
    );
    return behavior.render;
  },
});
