import { defineAsHook, definePrototype, type ExposeState } from '@proto.ui/core';
import { setupCheckboxRoot } from '../checkbox/root.proto';
import type {
  CheckboxRootProps,
  CheckboxRootExposes,
  CheckboxRootAsHookContract,
} from '../checkbox/types';
import type { FieldControlBindingProps, FieldControlBindingHandles } from './types';
export type FieldCheckboxProps = CheckboxRootProps & FieldControlBindingProps;
export type FieldCheckboxExposes = CheckboxRootExposes & {
  invalid: ExposeState<boolean>;
  pending: ExposeState<boolean>;
};
export type FieldCheckboxAsHookContract = CheckboxRootAsHookContract & {
  asHooks: { 'as-optional-field-control': FieldControlBindingHandles };
};
export const asFieldCheckbox = defineAsHook<
  FieldCheckboxProps,
  FieldCheckboxExposes,
  FieldCheckboxAsHookContract
>({
  name: 'as-field-checkbox',
  setup: (def) => setupCheckboxRoot(def, { fieldBinding: true }),
});
export default definePrototype<FieldCheckboxProps, FieldCheckboxExposes>({
  name: 'base-field-checkbox',
  setup: (def) => setupCheckboxRoot(def, { fieldBinding: true }),
});
