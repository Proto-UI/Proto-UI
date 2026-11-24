import type { NumberFieldControlExposes } from './types';
import type { ObservedStateHandle, State } from '@proto.ui/core';
import { defineAsHook, definePrototype } from '@proto.ui/core';
import { declareTextControl } from '@proto.ui/module-text-control';
import type { NumberFieldPartProps } from './types';
import { setupNumberFieldInput } from './input.proto';
export const asNumberFieldControl = defineAsHook<
  NumberFieldPartProps,
  NumberFieldControlExposes,
  {
    state: {
      disabled: State<boolean>;
      focusVisible: ObservedStateHandle<boolean, NumberFieldPartProps>;
      value: State<number>;
      empty: State<boolean>;
      readOnly: State<boolean>;
      required: State<boolean>;
      focused: ObservedStateHandle<boolean, NumberFieldPartProps>;
    };
    asHooks: { 'as-field-control': import('../field').FieldControlBindingHandles };
  }
>({
  name: 'as-number-field-control',
  modules: [declareTextControl({ content: 'plain-text', lineMode: 'single', engine: 'host' })],
  setup: (def) => setupNumberFieldInput(def, true),
});
export default definePrototype<NumberFieldPartProps, NumberFieldControlExposes>({
  name: 'base-number-field-control',
  modules: asNumberFieldControl.modules,
  setup: (def) => setupNumberFieldInput(def, true),
});
