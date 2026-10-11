import { definePrototype, tw } from '@proto.ui/core';
import {
  asComboboxTrigger,
  type ComboboxTriggerProps,
  type ComboboxTriggerExposes,
} from '@proto.ui/prototypes-base/combobox';
export default definePrototype<ComboboxTriggerProps, ComboboxTriggerExposes>({
  name: 'brutalist-combobox-trigger',
  setup(def) {
    const behavior = asComboboxTrigger();
    def.feedback.style.use(
      tw(
        'rounded-none border-2 border-foreground inline-flex items-center justify-center px-3 py-2 outline-none'
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
  },
});
