import { definePrototype, tw } from '@proto.ui/core';
import { COMMAND_BLOCKED, COMMAND_FOCUS, COMMAND_FOCUSED_ELEVATION } from '../interactive-surface';
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
    const disabled = behavior.getState!('disabled')!;
    def.feedback.style.use(
      tw(
        'font-sans rounded-xl border border-border min-w-0 grow bg-background px-3 py-2 text-base text-foreground placeholder:text-muted-foreground outline-none transition-shadow'
      )
    );
    def.rule({
      when: (w) =>
        w.all(w.state(behavior.getState!('focused')!).eq(true), w.state(disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUSED_ELEVATION)),
    });
    def.rule({
      when: (w) => w.state(behavior.getState!('focusVisible')!).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS)),
    });
    def.rule({
      when: (w) => w.meta('preference.reducedMotion').eq('reduce'),
      intent: (i) => i.feedback.style.use(tw('duration-0')),
    });
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw(`${COMMAND_BLOCKED} bg-muted text-muted-foreground`)),
    });
    return behavior.render;
  },
});
