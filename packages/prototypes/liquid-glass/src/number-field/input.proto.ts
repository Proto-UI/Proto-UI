import type {
  NumberFieldInputExposes,
  NumberFieldPartProps,
} from '@proto.ui/prototypes-base/number-field';
import { definePrototype, tw } from '@proto.ui/core';
import { asNumberFieldInput } from '@proto.ui/prototypes-base/number-field';
import { COMMAND_FOCUS } from '../interactive-surface';
export default definePrototype<NumberFieldPartProps, NumberFieldInputExposes>({
  name: 'liquid-glass-number-field-input',
  modules: asNumberFieldInput.modules,
  setup(def) {
    const inherited = asNumberFieldInput();
    const state = inherited.stateHandles!;
    def.feedback.style.use(
      tw(
        'block min-h-11 min-w-0 flex-1 rounded-2xl border border-border bg-background px-4 py-2 font-sans text-base tabular-nums text-foreground placeholder:text-muted-foreground outline-none transition-colors'
      )
    );
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS)),
    });
    def.rule({
      when: (w) => w.all(w.state(state.readOnly).eq(true), w.state(state.disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw('bg-muted/50 text-muted-foreground')),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-muted text-muted-foreground cursor-not-allowed')),
    });
    return inherited.render;
  },
});
