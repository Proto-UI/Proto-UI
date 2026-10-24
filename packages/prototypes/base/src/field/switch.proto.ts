import { defineAsHook, definePrototype, type ExposeState } from '@proto.ui/core';
import { asSwitchRoot, setupSwitchRoot } from '../switch/root.proto';
import type { SwitchRootProps, SwitchRootExposes, SwitchRootAsHookContract } from '../switch/types';
import type { FieldControlBindingProps, FieldControlBindingHandles } from './types';
export type FieldSwitchProps = SwitchRootProps & FieldControlBindingProps;
export type FieldSwitchExposes = SwitchRootExposes & {
  invalid: ExposeState<boolean>;
  pending: ExposeState<boolean>;
};
export type FieldSwitchAsHookContract = SwitchRootAsHookContract & {
  asHooks: { 'as-optional-field-control': FieldControlBindingHandles };
};
export const asFieldSwitch = defineAsHook<
  FieldSwitchProps,
  FieldSwitchExposes,
  FieldSwitchAsHookContract
>({
  name: 'as-field-switch',
  modules: asSwitchRoot.modules,
  setup: (def) => setupSwitchRoot(def, { fieldBinding: true }),
});
export default definePrototype<FieldSwitchProps, FieldSwitchExposes>({
  name: 'base-field-switch',
  modules: asFieldSwitch.modules,
  setup: (def) => setupSwitchRoot(def, { fieldBinding: true }),
});
