import { definePrototype, tw } from '@proto.ui/core';
import {
  asAutocompleteInput,
  type AutocompleteInputProps,
  type AutocompleteInputExposes,
} from '@proto.ui/prototypes-base/autocomplete';
export default definePrototype<AutocompleteInputProps, AutocompleteInputExposes>({
  name: 'liquid-glass-autocomplete-input',
  modules: asAutocompleteInput.modules,
  setup(def) {
    const behavior = asAutocompleteInput();
    def.feedback.style.use(
      tw(
        'rounded-xl border border-border min-w-0 grow bg-background px-3 py-2 text-base text-foreground outline-none'
      )
    );
    def.rule({
      when: (w) => w.state(behavior.getState!('focusVisible')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('ring-2 ring-ring ring-offset-2')),
    });
    def.rule({
      when: (w) => w.state(behavior.getState!('disabled')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-not-allowed')),
    });
    return () => null;
  },
});
