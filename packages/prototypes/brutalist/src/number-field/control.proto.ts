import type {
  NumberFieldControlExposes,
  NumberFieldPartProps,
} from '@proto.ui/prototypes-base/number-field';
import { definePrototype, tw } from '@proto.ui/core';
import { asNumberFieldControl } from '@proto.ui/prototypes-base/number-field';
import { BRUTALIST_FOCUS_TOKENS } from '../style';
export default definePrototype<NumberFieldPartProps, NumberFieldControlExposes>({
  name: 'brutalist-number-field-control',
  modules: asNumberFieldControl.modules,
  setup(def) {
    const inherited = asNumberFieldControl();
    const state = inherited.stateHandles!;
    const binding = inherited.getAsHookHandle?.('as-field-control');
    def.feedback.style.use(
      tw(
        'block min-h-10 min-w-0 flex-1 rounded-base border-2 border-border bg-secondary-background px-3 py-2 font-sans text-sm font-medium tabular-nums text-foreground placeholder:text-muted-foreground outline-none'
      )
    );
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw(BRUTALIST_FOCUS_TOKENS, 'forced-colors-focus-outline')),
    });
    if (binding) {
      def.rule({
        when: (w) => w.state(binding.state.invalid).eq(true),
        intent: (i) => i.feedback.style.use(tw('border-destructive ring-2 ring-destructive/40')),
      });
    }
    def.rule({
      when: (w) => w.all(w.state(state.readOnly).eq(true), w.state(state.disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw('bg-muted text-muted-foreground')),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-not-allowed')),
    });
    return inherited.render;
  },
});
