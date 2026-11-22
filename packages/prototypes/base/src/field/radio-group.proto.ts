import { defineAsHook, definePrototype, type ExposeState } from '@proto.ui/core';
import { setupRadioGroupRoot } from '../radio-group/root.proto';
import type {
  RadioGroupRootProps,
  RadioGroupRootExposes,
  RadioGroupRootAsHookContract,
} from '../radio-group/types';
import type { FieldControlBindingProps, FieldControlBindingHandles } from './types';
export type FieldRadioGroupProps = RadioGroupRootProps & FieldControlBindingProps;
export type FieldRadioGroupExposes = RadioGroupRootExposes & {
  invalid: ExposeState<boolean>;
  pending: ExposeState<boolean>;
};
export type FieldRadioGroupAsHookContract = RadioGroupRootAsHookContract & {
  asHooks: { 'as-optional-field-control': FieldControlBindingHandles };
};
export const asFieldRadioGroup = defineAsHook<
  FieldRadioGroupProps,
  FieldRadioGroupExposes,
  FieldRadioGroupAsHookContract
>({
  name: 'as-field-radio-group',
  setup: (def) => setupRadioGroupRoot(def, { fieldBinding: true }),
});
export default definePrototype<FieldRadioGroupProps, FieldRadioGroupExposes>({
  name: 'base-field-radio-group',
  setup: (def) => setupRadioGroupRoot(def, { fieldBinding: true }),
});
