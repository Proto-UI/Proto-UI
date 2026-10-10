import { definePrototype, tw } from '@proto.ui/core';
import {
  asAutocompleteContent,
  type AutocompleteContentProps,
  type AutocompleteContentExposes,
} from '@proto.ui/prototypes-base/autocomplete';
export default definePrototype<AutocompleteContentProps, AutocompleteContentExposes>({
  name: 'shadcn-autocomplete-content',
  setup(def) {
    const behavior = asAutocompleteContent();
    def.feedback.style.use(
      tw(
        'rounded-lg border border-border bg-popover text-popover-foreground shadow-md z-50 min-w-0 w-[max(var(--proto-ui-anchor-width,16rem),12rem)] max-w-[var(--proto-ui-available-width,100%)] max-h-[var(--proto-ui-available-height,20rem)] overflow-y-auto p-1'
      )
    );
  },
});
