import { definePrototype, tw } from '@proto.ui/core';
import {
  asAutocompleteInput,
  type AutocompleteInputProps,
  type AutocompleteInputExposes,
} from '@proto.ui/prototypes-base/autocomplete';
import { COMMAND_FOCUS } from '../interactive-surface';

export default definePrototype<AutocompleteInputProps, AutocompleteInputExposes>({
  name: 'liquid-glass-autocomplete-input',
  modules: asAutocompleteInput.modules,
  setup(def) {
    const behavior = asAutocompleteInput();
    def.feedback.style.use(
      tw(
        'rounded-xl border border-border min-w-0 flex-1 bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground'
      )
    );
    def.rule({
      when: (w) => w.state(behavior.getState!('focusVisible')!).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS)),
    });
    def.rule({
      when: (w) => w.state(behavior.getState!('disabled')!).eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw('bg-muted text-muted-foreground border-border/50 cursor-not-allowed shadow-none')
        ),
    });
    return behavior.render;
  },
});
