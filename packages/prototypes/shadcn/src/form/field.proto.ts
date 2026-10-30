import type { FormFieldExposes } from '@proto.ui/prototypes-base/form';
import { definePrototype } from '@proto.ui/core';
import { asFormField } from '@proto.ui/prototypes-base/form';
import type { ShadcnFormFieldProps } from './types';
import { setupFieldRootVisual } from '../field/visual';
export default definePrototype<ShadcnFormFieldProps, FormFieldExposes>({
  name: 'shadcn-form-field',
  modules: asFormField.modules,
  setup(def) {
    const inherited = asFormField();
    const field = inherited.getAsHookHandle?.('as-field-root');
    if (!field) throw new Error('[form-field] Base FieldRoot handle required.');
    setupFieldRootVisual(def, field.stateHandles!.invalid);
    return inherited.render;
  },
});
