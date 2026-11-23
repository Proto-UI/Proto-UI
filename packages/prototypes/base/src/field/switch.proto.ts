import {
  defineAsHook,
  definePrototype,
  type DefHandle,
  type ExposeMethod,
  type ExposeState,
} from '@proto.ui/core';
import { asSwitchRoot, setupSwitchRoot } from '../switch/root.proto';
import type { SwitchRootProps, SwitchRootExposes, SwitchRootAsHookContract } from '../switch/types';
import type { FieldControlBindingProps, FieldControlBindingHandles } from './types';
export type FieldSwitchProps = SwitchRootProps & FieldControlBindingProps;
export type FieldSwitchExposes = SwitchRootExposes & {
  invalid: ExposeState<boolean>;
  pending: ExposeState<boolean>;
  resetValue: ExposeMethod<() => boolean>;
};
export type FieldSwitchAsHookContract = SwitchRootAsHookContract & {
  asHooks: { 'as-optional-field-control': FieldControlBindingHandles };
};
function setup(def: DefHandle<FieldSwitchProps, FieldSwitchExposes>) {
  setupSwitchRoot(def, {
    fieldBinding: true,
    registerResetValue: (resetValue) => def.expose.method('resetValue', resetValue),
  });
}
export const asFieldSwitch = defineAsHook<
  FieldSwitchProps,
  FieldSwitchExposes,
  FieldSwitchAsHookContract
>({
  name: 'as-field-switch',
  modules: asSwitchRoot.modules,
  setup,
});
export default definePrototype<FieldSwitchProps, FieldSwitchExposes>({
  name: 'base-field-switch',
  modules: asFieldSwitch.modules,
  setup,
});
