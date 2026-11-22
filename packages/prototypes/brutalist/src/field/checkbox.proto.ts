import { definePrototype } from '@proto.ui/core';
import {
  asFieldCheckbox,
  type FieldCheckboxProps,
  type FieldCheckboxExposes,
} from '@proto.ui/prototypes-base/field';
import type { BrutalistCheckboxRootProps, BrutalistCheckboxRootExposes } from '../checkbox/types';
import { setupCheckboxRootVisual } from '../checkbox/root-visual';
export type BrutalistFieldCheckboxProps = FieldCheckboxProps & BrutalistCheckboxRootProps;
export type BrutalistFieldCheckboxExposes = FieldCheckboxExposes & BrutalistCheckboxRootExposes;
export default definePrototype<BrutalistFieldCheckboxProps, BrutalistFieldCheckboxExposes>({
  name: 'brutalist-field-checkbox',
  setup(def) {
    const control = asFieldCheckbox();
    const binding = control.getAsHookHandle!('as-optional-field-control');
    if (!control.stateHandles || !binding)
      throw new Error('[brutalist-field-checkbox] Missing Base/Field facts.');
    setupCheckboxRootVisual(def, control.stateHandles, binding.state.invalid);
    return control.render;
  },
});
