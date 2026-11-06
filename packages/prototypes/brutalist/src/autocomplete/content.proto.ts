import { definePrototype, tw } from '@proto.ui/core';
import { BRUTALIST_PANEL_TOKENS } from '../style';
import {
  asAutocompleteContent,
  type AutocompleteContentProps,
  type AutocompleteContentExposes,
} from '@proto.ui/prototypes-base/autocomplete';
export default definePrototype<AutocompleteContentProps, AutocompleteContentExposes>({
  name: 'brutalist-autocomplete-content',
  setup(def) {
    const behavior = asAutocompleteContent();
    def.feedback.style.use(
      tw(
        `${BRUTALIST_PANEL_TOKENS} z-50 min-w-0 w-[max(var(--proto-ui-anchor-width,16rem),12rem)] max-w-[var(--proto-ui-available-width,100%)] max-h-[var(--proto-ui-available-height,20rem)] overflow-y-auto p-1`
      )
    );
  },
});
