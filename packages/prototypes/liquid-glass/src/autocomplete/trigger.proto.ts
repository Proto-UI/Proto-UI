import { definePrototype, tw } from '@proto.ui/core';
import { COMMAND_BLOCKED, COMMAND_FOCUS } from '../interactive-surface';
import {
  asAutocompleteTrigger,
  type AutocompleteTriggerProps,
  type AutocompleteTriggerExposes,
} from '@proto.ui/prototypes-base/autocomplete';
export default definePrototype<AutocompleteTriggerProps, AutocompleteTriggerExposes>({
  name: 'liquid-glass-autocomplete-trigger',
  setup(def) {
    const behavior = asAutocompleteTrigger();
    def.feedback.style.use(
      tw(
        'rounded-xl border border-border bg-secondary text-secondary-foreground inline-flex items-center justify-center px-3 py-2 outline-none'
      )
    );
    def.rule({
      when: (w) => w.state(behavior.getState!('focusVisible')!).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS)),
    });
    def.rule({
      when: (w) => w.state(behavior.getState!('disabled')!).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_BLOCKED)),
    });
    return behavior.render;
  },
});
