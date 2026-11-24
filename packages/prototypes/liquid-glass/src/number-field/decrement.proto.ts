import type {
  NumberFieldPartProps,
  NumberFieldStepExposes,
} from '@proto.ui/prototypes-base/number-field';
import { definePrototype, tw } from '@proto.ui/core';
import { asNumberFieldDecrement } from '@proto.ui/prototypes-base/number-field';
import { COMMAND_BLOCKED, COMMAND_FOCUS } from '../interactive-surface';
export default definePrototype<NumberFieldPartProps, NumberFieldStepExposes>({
  name: 'liquid-glass-number-field-decrement',
  modules: asNumberFieldDecrement.modules,
  setup(def) {
    const inherited = asNumberFieldDecrement();
    const state = inherited.stateHandles!;
    def.feedback.style.use(
      tw(
        'inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-secondary p-2 font-sans text-secondary-foreground shadow-xs select-none cursor-pointer outline-none transition-shadow'
      )
    );
    def.rule({
      when: (w) => w.state(state.disabled).eq(false),
      intent: (i) => i.feedback.style.use(tw('hover:shadow-md active:shadow-xs active:bg-muted')),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS)),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_BLOCKED, 'bg-muted text-muted-foreground')),
    });
    return inherited.render;
  },
});
