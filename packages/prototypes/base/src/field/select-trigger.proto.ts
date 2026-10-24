import { defineAsHook, definePrototype, type ExposeState } from '@proto.ui/core';
import { asSelectTrigger, setupSelectTrigger } from '../select/trigger.proto';
import type {
  SelectTriggerProps,
  SelectTriggerExposes,
  SelectTriggerAsHookContract,
} from '../select/types';
import type { FieldControlBindingProps, FieldControlBindingHandles } from './types';
export type FieldSelectTriggerProps = SelectTriggerProps & FieldControlBindingProps;
export type FieldSelectTriggerExposes = SelectTriggerExposes & {
  invalid: ExposeState<boolean>;
  pending: ExposeState<boolean>;
};
export type FieldSelectTriggerAsHookContract = SelectTriggerAsHookContract & {
  asHooks: { 'as-optional-field-control': FieldControlBindingHandles };
};
export const asFieldSelectTrigger = defineAsHook<
  FieldSelectTriggerProps,
  FieldSelectTriggerExposes,
  FieldSelectTriggerAsHookContract
>({
  name: 'as-field-select-trigger',
  modules: asSelectTrigger.modules,
  setup: (def) => setupSelectTrigger(def, { fieldBinding: true }),
});
export default definePrototype<FieldSelectTriggerProps, FieldSelectTriggerExposes>({
  name: 'base-field-select-trigger',
  modules: asFieldSelectTrigger.modules,
  setup: (def) => setupSelectTrigger(def, { fieldBinding: true }),
});
