import { definePrototype } from '@proto.ui/core';
import {
  asFieldCheckbox,
  type FieldCheckboxProps,
  type FieldCheckboxExposes,
} from '@proto.ui/prototypes-base/field';
import type { ShadcnCheckboxRootProps, ShadcnCheckboxRootExposes } from '../checkbox/types';
import { setupCheckboxRootVisual } from '../checkbox/root-visual';
export type ShadcnFieldCheckboxProps = FieldCheckboxProps & ShadcnCheckboxRootProps;
export type ShadcnFieldCheckboxExposes = FieldCheckboxExposes & ShadcnCheckboxRootExposes;
export default definePrototype<ShadcnFieldCheckboxProps, ShadcnFieldCheckboxExposes>({
  name: 'shadcn-field-checkbox',
  setup(def) {
    const control = asFieldCheckbox();
    const binding = control.getAsHookHandle!('as-optional-field-control');
    if (!control.stateHandles || !binding)
      throw new Error('[shadcn-field-checkbox] Missing Base/Field facts.');
    setupCheckboxRootVisual(def, control.stateHandles, binding.state.invalid);
    return control.render;
  },
});
