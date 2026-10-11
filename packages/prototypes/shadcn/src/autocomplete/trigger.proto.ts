import { definePrototype, tw } from '@proto.ui/core';
import {
  asAutocompleteTrigger,
  type AutocompleteTriggerProps,
  type AutocompleteTriggerExposes,
} from '@proto.ui/prototypes-base/autocomplete';
export default definePrototype<AutocompleteTriggerProps, AutocompleteTriggerExposes>({
  name: 'shadcn-autocomplete-trigger',
  setup(def) {
    const behavior = asAutocompleteTrigger();
    def.feedback.style.use(
      tw(
        'rounded-md border border-input inline-flex items-center justify-center px-3 py-2 outline-none'
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
