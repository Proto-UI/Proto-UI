import { definePrototype } from '@proto.ui/core';
import type {
  ProtoAdapterProps as PropsOf,
  ProtoAdapterExposes as ExposesOf,
} from '@proto.ui/adapter-base';
import { asFieldCheckbox, asFieldRadioGroup, fieldCheckbox, fieldRadioGroup } from '../src/field';
import {
  fieldCheckbox as shadcnCheckbox,
  fieldRadioGroup as shadcnRadio,
} from '../../shadcn/src/field';
import {
  fieldCheckbox as brutalistCheckbox,
  fieldRadioGroup as brutalistRadio,
  fieldSwitch,
} from '../../brutalist/src/field';
const props: PropsOf<typeof fieldCheckbox> = {
  checked: false,
  indeterminate: true,
  readOnly: true,
  required: true,
};
const radioProps: PropsOf<typeof fieldRadioGroup> = {
  value: 'basic',
  readOnly: true,
  required: true,
};
const shadcnProps: PropsOf<typeof shadcnCheckbox> = props;
const brutalistProps: PropsOf<typeof brutalistCheckbox> = props;
const shadcnRadioProps: PropsOf<typeof shadcnRadio> = radioProps;
const brutalistRadioProps: PropsOf<typeof brutalistRadio> = radioProps;
const switchProps: PropsOf<typeof fieldSwitch> = {
  checked: false,
  readOnly: true,
  draggable: false,
};
void [shadcnProps, brutalistProps, shadcnRadioProps, brutalistRadioProps, switchProps];
declare const checkbox: ExposesOf<typeof fieldCheckbox>;
declare const radio: ExposesOf<typeof fieldRadioGroup>;
const checked: boolean = checkbox.checked.get();
const value: string = radio.value.get();
const reset: boolean = checkbox.resetValue();
declare const switchControl: ExposesOf<typeof fieldSwitch>;
const switchReset: boolean = switchControl.resetValue();
void switchReset;
void [checked, value, reset];
definePrototype({
  name: 'field-choice-authored-consumer',
  setup() {
    const c = asFieldCheckbox();
    const checked: boolean = c.stateHandles!.checked.get();
    const readonly: boolean = c.stateHandles!.readOnly.get();
    const invalid: boolean = c.getAsHookHandle!('as-optional-field-control')!.state.invalid.get();
    void [checked, readonly, invalid];
  },
});
definePrototype({
  name: 'field-radio-authored-consumer',
  setup() {
    const group = asFieldRadioGroup();
    const value: string = group.stateHandles!.value.get();
    const focused: boolean = group.stateHandles!.focused.get();
    void [value, focused];
  },
});
