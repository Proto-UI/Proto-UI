import type { NumberFieldInputExposes } from '@proto.ui/prototypes-base/number-field';
import { definePrototype, tw } from '@proto.ui/core';
import { asNumberFieldInput } from '@proto.ui/prototypes-base/number-field';
import { setupInputVisual } from '../input/visual';
import type { ShadcnNumberFieldPartProps } from './types';

/** Proto numeric draft editor borrowing pinned Input paint, not an upstream NumberField API. */
export default definePrototype<ShadcnNumberFieldPartProps, NumberFieldInputExposes>({
  name: 'shadcn-number-field-input',
  modules: asNumberFieldInput.modules,
  setup(def) {
    const inherited = asNumberFieldInput();
    const state = inherited.stateHandles!;
    setupInputVisual(def, state, undefined, false);
    def.feedback.style.use(tw('block flex-1 tabular-nums'));
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw('forced-colors-focus-outline')),
    });
    def.rule({
      when: (w) => w.all(w.state(state.readOnly).eq(true), w.state(state.disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw('bg-muted/50 text-muted-foreground')),
    });
    return inherited.render;
  },
});
