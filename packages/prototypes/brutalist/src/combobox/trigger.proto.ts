import { definePrototype, tw } from '@proto.ui/core';
import {
  BRUTALIST_CONTROL_TOKENS,
  BRUTALIST_DISABLED_TOKENS,
  BRUTALIST_FOCUS_TOKENS,
} from '../style';
import {
  asComboboxTrigger,
  type ComboboxTriggerProps,
  type ComboboxTriggerExposes,
} from '@proto.ui/prototypes-base/combobox';
export default definePrototype<ComboboxTriggerProps, ComboboxTriggerExposes>({
  name: 'brutalist-combobox-trigger',
  modules: asComboboxTrigger.modules,
  setup(def) {
    const behavior = asComboboxTrigger();
    def.feedback.style.use(
      tw(
        `${BRUTALIST_CONTROL_TOKENS} inline-flex shrink-0 h-10 min-w-10 items-center justify-center gap-1.5 px-3 text-sm outline-none cursor-pointer select-none`
      )
    );
    def.rule({
      when: (w) => w.state(behavior.getState!('focusVisible')!).eq(true),
      intent: (i) => i.feedback.style.use(tw(BRUTALIST_FOCUS_TOKENS)),
    });
    def.rule({
      when: (w) => w.state(behavior.getState!('disabled')!).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw(`${BRUTALIST_DISABLED_TOKENS} shadow-none cursor-not-allowed`)),
    });
    return behavior.render;
  },
});
