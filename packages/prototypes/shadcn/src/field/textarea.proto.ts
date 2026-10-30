import { definePrototype } from '@proto.ui/core';
import {
  asFieldTextarea,
  type FieldTextareaProps,
  type FieldTextareaExposes,
} from '@proto.ui/prototypes-base/field';
import type { ShadcnStyleProps } from '../style-scope';
import { setupTextareaVisual } from '../textarea/visual';
export type ShadcnFieldTextareaProps = FieldTextareaProps & ShadcnStyleProps;
export type ShadcnFieldTextareaExposes = FieldTextareaExposes;
/** Semantic Field composition: same Base editor and same public-family paint setup. */
export default definePrototype<ShadcnFieldTextareaProps, ShadcnFieldTextareaExposes>({
  name: 'shadcn-field-textarea',
  modules: asFieldTextarea.modules,
  setup(def) {
    const textarea = asFieldTextarea();
    const binding = textarea.getAsHookHandle!('as-optional-field-control');
    if (!textarea.stateHandles || !binding)
      throw new Error('[shadcn-field-textarea] Missing Base/Field facts.');
    setupTextareaVisual(def, textarea.stateHandles, binding.state.invalid);
    return textarea.render;
  },
});
