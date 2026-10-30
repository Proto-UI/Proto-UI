import { definePrototype } from '@proto.ui/core';
import {
  asFieldTextarea,
  type FieldTextareaExposes,
  type FieldTextareaProps,
} from '@proto.ui/prototypes-base/field';
import { setupLiquidTextareaVisual } from '../textarea/visual';

export type LiquidGlassFieldTextareaProps = FieldTextareaProps;
export type LiquidGlassFieldTextareaExposes = FieldTextareaExposes;

// Match the public Field-bound entry, not an ordinary Textarea plus a second
// bridge. Base retains optional Field policy, canonical reporting and exact
// label/description/error relationships on the same physical editor.
export default definePrototype<LiquidGlassFieldTextareaProps, LiquidGlassFieldTextareaExposes>({
  name: 'liquid-glass-field-textarea',
  modules: asFieldTextarea.modules,
  setup(def) {
    const inherited = asFieldTextarea();
    const state = inherited.stateHandles;
    const binding = inherited.getAsHookHandle!('as-optional-field-control');
    if (!state || !binding)
      throw new Error('[liquid-glass-field-textarea] Base Textarea and Field facts are required.');
    setupLiquidTextareaVisual(def, state, binding.state.invalid);
    return inherited.render;
  },
});
