import { definePrototype, tw } from '@proto.ui/core';
import { COMMAND_BLOCKED, COMMAND_FOCUS } from '../interactive-surface';
import {
  asComboboxTrigger,
  type ComboboxTriggerProps,
  type ComboboxTriggerExposes,
} from '@proto.ui/prototypes-base/combobox';
export default definePrototype<ComboboxTriggerProps, ComboboxTriggerExposes>({
  name: 'liquid-glass-combobox-trigger',
  setup(def) {
    const behavior = asComboboxTrigger();
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
