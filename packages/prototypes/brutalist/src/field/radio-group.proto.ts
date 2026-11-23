import { definePrototype } from '@proto.ui/core';
import {
  asFieldRadioGroup,
  type FieldRadioGroupProps,
  type FieldRadioGroupExposes,
} from '@proto.ui/prototypes-base/field';
import type {
  BrutalistRadioGroupRootProps,
  BrutalistRadioGroupRootExposes,
} from '../radio-group/types';
import { setupRadioGroupRootVisual } from '../radio-group/root-visual';
export type BrutalistFieldRadioGroupProps = FieldRadioGroupProps & BrutalistRadioGroupRootProps;
export type BrutalistFieldRadioGroupExposes = FieldRadioGroupExposes &
  BrutalistRadioGroupRootExposes;
export default definePrototype<BrutalistFieldRadioGroupProps, BrutalistFieldRadioGroupExposes>({
  name: 'brutalist-field-radio-group',
  setup(def) {
    const group = asFieldRadioGroup();
    setupRadioGroupRootVisual(def);
    return group.render;
  },
});
