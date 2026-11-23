import { definePrototype } from '@proto.ui/core';
import {
  asFieldTextarea,
  type FieldTextareaProps,
  type FieldTextareaExposes,
} from '@proto.ui/prototypes-base/field';
import { setupTextareaVisual } from '../textarea/visual';

export default definePrototype<FieldTextareaProps, FieldTextareaExposes>({
  name: 'brutalist-field-textarea',
  modules: asFieldTextarea.modules,
  setup(def) {
    const textarea = asFieldTextarea();
    const binding = textarea.getAsHookHandle!('as-optional-field-control');
    if (!textarea.stateHandles || !binding)
      throw new Error('[brutalist-field-textarea] Missing Base/Field facts.');
    setupTextareaVisual(def, textarea.stateHandles, binding.state.invalid);
    return textarea.render;
  },
});
