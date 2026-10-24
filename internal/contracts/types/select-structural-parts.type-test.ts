import type { ShadcnStyleProps } from '@proto.ui/prototypes-shadcn/style-scope';
import { definePrototype } from '@proto.ui/core';
import {
  asSelectGroup,
  asSelectLabel,
  asSelectSeparator,
  selectGroup,
  selectLabel,
  selectSeparator,
} from '@proto.ui/prototypes-base';
import type {
  SelectGroupProps,
  SelectGroupExposes,
  SelectGroupAsHookContract,
  SelectLabelProps,
  SelectLabelExposes,
  SelectLabelAsHookContract,
  SelectSeparatorProps,
  SelectSeparatorExposes,
  SelectSeparatorAsHookContract,
} from '@proto.ui/prototypes-base/select';
import {
  shadcnSelectGroup,
  shadcnSelectLabel,
  shadcnSelectSeparator,
} from '@proto.ui/prototypes-shadcn';
import type {
  ShadcnSelectGroupProps,
  ShadcnSelectGroupExposes,
  ShadcnSelectGroupAsHookContract,
  ShadcnSelectLabelProps,
  ShadcnSelectLabelExposes,
  ShadcnSelectLabelAsHookContract,
  ShadcnSelectSeparatorProps,
  ShadcnSelectSeparatorExposes,
  ShadcnSelectSeparatorAsHookContract,
} from '@proto.ui/prototypes-shadcn/select';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;
type PublicStructuralTypes = [
  Assert<Equal<SelectGroupProps & ShadcnStyleProps, ShadcnSelectGroupProps>>,
  Assert<Equal<SelectGroupExposes, ShadcnSelectGroupExposes>>,
  Assert<Equal<SelectGroupAsHookContract, ShadcnSelectGroupAsHookContract>>,
  Assert<Equal<SelectLabelProps & ShadcnStyleProps, ShadcnSelectLabelProps>>,
  Assert<Equal<SelectLabelExposes, ShadcnSelectLabelExposes>>,
  Assert<Equal<SelectLabelAsHookContract, ShadcnSelectLabelAsHookContract>>,
  Assert<Equal<SelectSeparatorProps & ShadcnStyleProps, ShadcnSelectSeparatorProps>>,
  Assert<Equal<SelectSeparatorExposes, ShadcnSelectSeparatorExposes>>,
  Assert<Equal<SelectSeparatorAsHookContract, ShadcnSelectSeparatorAsHookContract>>,
];
void [
  selectGroup,
  selectLabel,
  selectSeparator,
  shadcnSelectGroup,
  shadcnSelectLabel,
  shadcnSelectSeparator,
];
definePrototype<SelectGroupProps, SelectGroupExposes>({
  name: 'typed-select-group',
  setup() {
    asSelectGroup();
  },
});
definePrototype<SelectLabelProps, SelectLabelExposes>({
  name: 'typed-select-label',
  setup() {
    asSelectLabel();
  },
});
definePrototype<SelectSeparatorProps, SelectSeparatorExposes>({
  name: 'typed-select-separator',
  setup() {
    asSelectSeparator();
    return () => null;
  },
});
