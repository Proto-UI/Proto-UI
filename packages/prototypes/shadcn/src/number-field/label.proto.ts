import type { NumberFieldLabelExposes } from '@proto.ui/prototypes-base/number-field';
import { definePrototype } from '@proto.ui/core';
import { asNumberFieldLabel } from '@proto.ui/prototypes-base/number-field';
import { setupFieldTextVisual } from '../field/visual';
import type { ShadcnNumberFieldPartProps } from './types';
export default definePrototype<ShadcnNumberFieldPartProps, NumberFieldLabelExposes>({
  name: 'shadcn-number-field-label',
  modules: asNumberFieldLabel.modules,
  setup(def) {
    const inherited = asNumberFieldLabel();
    setupFieldTextVisual(def, 'label');
    return inherited.render;
  },
});
