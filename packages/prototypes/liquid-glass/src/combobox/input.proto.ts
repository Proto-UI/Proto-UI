import { definePrototype, tw } from '@proto.ui/core';
import {
  asComboboxInput,
  type ComboboxInputProps,
  type ComboboxInputExposes,
} from '@proto.ui/prototypes-base/combobox';
export default definePrototype<ComboboxInputProps, ComboboxInputExposes>({
  name: 'liquid-glass-combobox-input',
  modules: asComboboxInput.modules,
  setup(def) {
    const behavior = asComboboxInput();
    def.feedback.style.use(
      tw(
        'rounded-xl border border-border min-w-0 grow bg-background px-3 py-2 text-base text-foreground outline-none'
      )
    );
    def.rule({
      when: (w) => w.state(behavior.getState!('focusVisible')!).eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw('forced-colors-focus-outline ring-2 ring-ring ring-offset-2 ring-offset-background')
        ),
    });
    def.rule({
      when: (w) => w.state(behavior.getState!('disabled')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('cursor-not-allowed shadow-none')),
    });
    return behavior.render;
  },
});
