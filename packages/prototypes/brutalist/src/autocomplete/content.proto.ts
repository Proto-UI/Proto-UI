import { definePrototype, tw } from '@proto.ui/core';
import { BRUTALIST_PANEL_TOKENS } from '../style';
import {
  asAutocompleteContent,
  type AutocompleteContentProps,
  type AutocompleteContentExposes,
} from '@proto.ui/prototypes-base/autocomplete';

export default definePrototype<AutocompleteContentProps, AutocompleteContentExposes>({
  name: 'brutalist-autocomplete-content',
  modules: asAutocompleteContent.modules,
  setup(def) {
    const behavior = asAutocompleteContent();
    def.feedback.style.use(
      tw(
        `${BRUTALIST_PANEL_TOKENS} shadow-[3px_3px_0_0_var(--pui-foreground)] z-50 min-w-0 w-[max(var(--proto-ui-anchor-width,16rem),12rem)] max-w-[var(--proto-ui-available-width,100%)] max-h-[var(--proto-ui-available-height,20rem)] overflow-y-auto p-1 outline-none`
      )
    );
    return behavior.render;
  },
});
