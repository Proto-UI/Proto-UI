import { definePrototype, tw } from '@proto.ui/core';
import {
  asFieldTextControl,
  type FieldControlProps,
  type FieldControlExposes,
} from '@proto.ui/prototypes-base/field';
import { setupInputVisual, bootstrapLightControlInvalidPaint } from '../input/visual';
export default definePrototype<FieldControlProps, FieldControlExposes>({
  name: 'bootstrap-2-3-2-field-control',
  modules: asFieldTextControl.modules,
  setup(def) {
    const inherited = asFieldTextControl();
    const state = inherited.stateHandles!;
    const binding = inherited.getAsHookHandle?.('as-field-control');
    if (!binding) throw new Error('[field-control] Base Field binding handle required.');
    setupInputVisual(def, state, binding.state.invalid);
    // Keep this Rule beside its existing public Field binding so the family
    // source collector can retain the emitted invalid selector.
    def.rule({
      when: (w) => w.state(binding.state.invalid).eq(true),
      intent: (i) => i.feedback.style.use(tw(bootstrapLightControlInvalidPaint)),
    });
    return inherited.render;
  },
});
