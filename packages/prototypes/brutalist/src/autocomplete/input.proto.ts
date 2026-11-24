import { definePrototype, tw } from '@proto.ui/core';
import {
  asAutocompleteInput,
  type AutocompleteInputProps,
  type AutocompleteInputExposes,
} from '@proto.ui/prototypes-base/autocomplete';
import { BRUTALIST_FOCUS_TOKENS } from '../style';

export default definePrototype<AutocompleteInputProps, AutocompleteInputExposes>({
  name: 'brutalist-autocomplete-input',
  modules: asAutocompleteInput.modules,
  setup(def) {
    const behavior = asAutocompleteInput();
    def.feedback.style.use(
      tw(
        'h-10 min-w-0 flex-1 rounded-base border-2 border-black bg-secondary-background px-3 py-2 text-sm font-sans font-medium text-foreground outline-none placeholder:text-muted-foreground'
      )
    );
    def.rule({
      when: (w) => w.state(behavior.getState!('focusVisible')!).eq(true),
      intent: (i) => i.feedback.style.use(tw(BRUTALIST_FOCUS_TOKENS)),
    });
    def.rule({
      when: (w) => w.state(behavior.getState!('disabled')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-not-allowed')),
    });
    return () => null;
  },
});
