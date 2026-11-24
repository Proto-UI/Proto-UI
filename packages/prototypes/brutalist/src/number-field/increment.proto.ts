import type {
  NumberFieldPartProps,
  NumberFieldStepExposes,
} from '@proto.ui/prototypes-base/number-field';
import { definePrototype, tw } from '@proto.ui/core';
import { asNumberFieldIncrement } from '@proto.ui/prototypes-base/number-field';
import { BRUTALIST_FOCUS_TOKENS } from '../style';
export default definePrototype<NumberFieldPartProps, NumberFieldStepExposes>({
  name: 'brutalist-number-field-increment',
  modules: asNumberFieldIncrement.modules,
  setup(def) {
    const inherited = asNumberFieldIncrement();
    const state = inherited.stateHandles!;
    def.feedback.style.use(
      tw(
        'inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-base border-2 border-border bg-secondary-background shadow-[2px_2px_0_0_var(--pui-border)] p-2 font-sans text-sm font-medium text-foreground select-none cursor-pointer outline-none'
      )
    );
    def.rule({
      when: (w) => w.state(state.disabled).eq(false),
      intent: (i) =>
        i.feedback.style.use(tw('hover:bg-main hover:text-main-foreground active:bg-main/80')),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw(BRUTALIST_FOCUS_TOKENS, 'forced-colors-focus-outline')),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-not-allowed shadow-none')),
    });
    return inherited.render;
  },
});
