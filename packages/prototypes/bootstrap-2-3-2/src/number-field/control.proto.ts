import type { NumberFieldControlExposes } from '@proto.ui/prototypes-base/number-field';
import type { NumberFieldPartProps } from '@proto.ui/prototypes-base/number-field';
import { definePrototype, tw } from '@proto.ui/core';
import { asNumberFieldControl } from '@proto.ui/prototypes-base/number-field';
import { setupInputVisual, bootstrapLightControlInvalidPaint } from '../input/visual';
export default definePrototype<NumberFieldPartProps, NumberFieldControlExposes>({
  name: 'bootstrap-2-3-2-number-field-control',
  modules: asNumberFieldControl.modules,
  setup(def) {
    const inherited = asNumberFieldControl();
    const binding = inherited.getAsHookHandle!('as-field-control');
    if (!binding) throw new Error('[bootstrap-2-3-2-number-field-control] Field binding required.');
    setupInputVisual(def, inherited.stateHandles!, binding.state.invalid);
    def.feedback.style.use(tw('tabular-nums'));
    // Keep this Rule beside its existing public Field binding so the family
    // source collector can retain the emitted invalid selector.
    def.rule({
      when: (w) => w.state(binding.state.invalid).eq(true),
      intent: (i) => i.feedback.style.use(tw(bootstrapLightControlInvalidPaint)),
    });
    return inherited.render;
  },
});
