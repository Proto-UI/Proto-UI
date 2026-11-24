import type { NumberFieldControlExposes } from '@proto.ui/prototypes-base/number-field';
import { definePrototype, tw } from '@proto.ui/core';
import { asNumberFieldControl } from '@proto.ui/prototypes-base/number-field';
import { setupInputVisual } from '../input/visual';
import type { ShadcnNumberFieldPartProps } from './types';

export default definePrototype<ShadcnNumberFieldPartProps, NumberFieldControlExposes>({
  name: 'shadcn-number-field-control',
  modules: asNumberFieldControl.modules,
  setup(def) {
    const inherited = asNumberFieldControl();
    const binding = inherited.getAsHookHandle?.('as-field-control');
    if (!inherited.stateHandles || !binding)
      throw new Error('[shadcn-number-field-control] Missing Base editor or Field binding.');
    const state = inherited.stateHandles;
    setupInputVisual(def, state, binding.state.invalid, true);
    def.feedback.style.use(tw('block flex-1 tabular-nums'));
    def.rule({
      when: (w) => w.all(w.state(state.readOnly).eq(true), w.state(state.disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw('bg-muted/50 text-muted-foreground')),
    });
    return inherited.render;
  },
});
