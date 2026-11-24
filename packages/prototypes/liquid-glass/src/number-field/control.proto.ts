import type {
  NumberFieldControlExposes,
  NumberFieldPartProps,
} from '@proto.ui/prototypes-base/number-field';
import { definePrototype, tw } from '@proto.ui/core';
import { asNumberFieldControl } from '@proto.ui/prototypes-base/number-field';
import { COMMAND_FOCUS } from '../interactive-surface';
export default definePrototype<NumberFieldPartProps, NumberFieldControlExposes>({
  name: 'liquid-glass-number-field-control',
  modules: asNumberFieldControl.modules,
  setup(def) {
    const inherited = asNumberFieldControl();
    const state = inherited.stateHandles!;
    const binding = inherited.getAsHookHandle?.('as-field-control');
    def.feedback.style.use(
      tw(
        'block min-h-11 min-w-0 flex-1 rounded-2xl border border-border bg-background px-4 py-2 font-sans text-base tabular-nums text-foreground placeholder:text-muted-foreground outline-none transition-colors'
      )
    );
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS)),
    });
    if (binding) {
      def.rule({
        when: (w) => w.state(binding.state.invalid).eq(true),
        intent: (i) => i.feedback.style.use(tw('border-destructive ring-2 ring-destructive/20')),
      });
    }
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
