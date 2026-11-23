import { definePrototype } from '@proto.ui/core';
import {
  asFieldRadioGroup,
  type FieldRadioGroupProps,
  type FieldRadioGroupExposes,
} from '@proto.ui/prototypes-base/field';
import type { ShadcnRadioGroupRootProps, ShadcnRadioGroupRootExposes } from '../radio-group/types';
import { setupRadioGroupRootVisual } from '../radio-group/root-visual';
export type ShadcnFieldRadioGroupProps = FieldRadioGroupProps & ShadcnRadioGroupRootProps;
export type ShadcnFieldRadioGroupExposes = FieldRadioGroupExposes & ShadcnRadioGroupRootExposes;
export default definePrototype<ShadcnFieldRadioGroupProps, ShadcnFieldRadioGroupExposes>({
  name: 'shadcn-field-radio-group',
  setup(def) {
    const group = asFieldRadioGroup();
    setupRadioGroupRootVisual(def);
    return group.render;
  },
});
