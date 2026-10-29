import { definePrototype } from '@proto.ui/core';
import {
  asFieldTextarea,
  type FieldTextareaProps,
  type FieldTextareaExposes,
} from '@proto.ui/prototypes-base/field';
import { setupTextareaVisual } from '../textarea/visual';

// Semantic Field composition: same Base editor and same family paint setup.
// The optional Field binding owns invalid/pending and label/description
// relationships; this prototype adds no second editor or validation owner.
export default definePrototype<FieldTextareaProps, FieldTextareaExposes>({
  name: 'bootstrap-2-3-2-field-textarea',
  modules: asFieldTextarea.modules,
  setup(def) {
    const textarea = asFieldTextarea();
    const binding = textarea.getAsHookHandle?.('as-optional-field-control');
    if (!textarea.stateHandles || !binding) {
      throw new Error('[bootstrap-2-3-2-field-textarea] Missing Base/Field facts.');
    }
    setupTextareaVisual(def, textarea.stateHandles, binding.state.invalid);
    return () => null;
  },
});
