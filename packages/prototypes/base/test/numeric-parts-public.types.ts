/** Positive public consumers and negative capability boundaries for every numeric part in all five families. */
import type { ProtoAdapterExposes } from '@proto.ui/adapter-base';
import * as f0slider from '@proto.ui/prototypes-base/slider';
function f0sliderTrack(x: ProtoAdapterExposes<typeof f0slider.sliderTrack>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const value: number = x.value.get();
  const percentage: number = x.percentage.get();
  const direction: string = x.direction.get();
  // @ts-expect-error readout value is numerical
  const wrong: string = x.value.get();
  // @ts-expect-error passive part does not expose thumb focus commands
  x.focusSelf();
}
function f0sliderLabel(x: ProtoAdapterExposes<typeof f0slider.sliderLabel>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const value: number = x.value.get();
  const percentage: number = x.percentage.get();
  const direction: string = x.direction.get();
  // @ts-expect-error readout value is numerical
  const wrong: string = x.value.get();
  // @ts-expect-error passive part does not expose thumb focus commands
  x.focusSelf();
}
function f0sliderIndicator(x: ProtoAdapterExposes<typeof f0slider.sliderIndicator>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const value: number = x.value.get();
  const percentage: number = x.percentage.get();
  const direction: string = x.direction.get();
  // @ts-expect-error readout value is numerical
  const wrong: string = x.value.get();
  // @ts-expect-error passive part does not expose thumb focus commands
  x.focusSelf();
}
function f0sliderValue(x: ProtoAdapterExposes<typeof f0slider.sliderValue>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const value: number = x.value.get();
  const percentage: number = x.percentage.get();
  const direction: string = x.direction.get();
  // @ts-expect-error readout value is numerical
  const wrong: string = x.value.get();
  // @ts-expect-error passive part does not expose thumb focus commands
  x.focusSelf();
}
function f0sliderThumb(x: ProtoAdapterExposes<typeof f0slider.sliderThumb>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const value: number = x.value.get();
  const percentage: number = x.percentage.get();
  const direction: string = x.direction.get();
  // @ts-expect-error readout value is numerical
  const wrong: string = x.value.get();
  x.focusSelf();
  const reset: boolean = x.resetValue();
  const focused: boolean = x.focusVisible.get();
  const hovered: boolean = x.hovered.get();
  const pressed: boolean = x.pressed.get();
  // @ts-expect-error no invented focus parameters
  x.focusSelf('bad');
}
function f0sliderFieldThumb(x: ProtoAdapterExposes<typeof f0slider.sliderFieldThumb>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const value: number = x.value.get();
  const percentage: number = x.percentage.get();
  const direction: string = x.direction.get();
  // @ts-expect-error readout value is numerical
  const wrong: string = x.value.get();
  x.focusSelf();
  const reset: boolean = x.resetValue();
  const focused: boolean = x.focusVisible.get();
  const hovered: boolean = x.hovered.get();
  const pressed: boolean = x.pressed.get();
  // @ts-expect-error no invented focus parameters
  x.focusSelf('bad');
  const invalid: boolean = x.invalid.get();
  const required: boolean = x.fieldRequired.get();
}
import * as f0numberfield from '@proto.ui/prototypes-base/number-field';
function f0numberfieldInput(x: ProtoAdapterExposes<typeof f0numberfield.numberFieldInput>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const value: number = x.value.get();
  const focused: boolean = x.focused.get();
  const reset: boolean = x.resetValue();
  x.focusSelf();
  // @ts-expect-error numeric value is not a string
  const wrong: string = x.value.get();
}
function f0numberfieldControl(x: ProtoAdapterExposes<typeof f0numberfield.numberFieldControl>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const value: number = x.value.get();
  const focused: boolean = x.focused.get();
  const reset: boolean = x.resetValue();
  x.focusSelf();
  // @ts-expect-error numeric value is not a string
  const wrong: string = x.value.get();
  const pending: boolean = x.pending.get();
  const invalid: boolean = x.invalid.get();
}
function f0numberfieldIncrement(x: ProtoAdapterExposes<typeof f0numberfield.numberFieldIncrement>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const disabled: boolean = x.disabled.get();
  const focused: boolean = x.focusVisible.get();
  // @ts-expect-error step button exposes no focusSelf method
  x.focusSelf();
}
function f0numberfieldDecrement(x: ProtoAdapterExposes<typeof f0numberfield.numberFieldDecrement>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const disabled: boolean = x.disabled.get();
  const focused: boolean = x.focusVisible.get();
  // @ts-expect-error step button exposes no focusSelf method
  x.focusSelf();
}
function f0numberfieldLabel(x: ProtoAdapterExposes<typeof f0numberfield.numberFieldLabel>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  // @ts-expect-error passive label has no value owner
  x.value.get();
}
import * as f0inputotp from '@proto.ui/prototypes-base/input-otp';
function f0inputotpInput(x: ProtoAdapterExposes<typeof f0inputotp.inputOtpInput>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const disabled: boolean = x.disabled.get();
  const focused: boolean = x.focusVisible.get();
  const reset: boolean = x.resetValue();
  x.focusSelf();
  // @ts-expect-error editor does not duplicate the Root public value state
  x.value.get();
}
function f0inputotpControl(x: ProtoAdapterExposes<typeof f0inputotp.inputOtpControl>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const disabled: boolean = x.disabled.get();
  const focused: boolean = x.focusVisible.get();
  const reset: boolean = x.resetValue();
  x.focusSelf();
  // @ts-expect-error editor does not duplicate the Root public value state
  x.value.get();
  const pending: boolean = x.pending.get();
  const invalid: boolean = x.invalid.get();
}
function f0inputotpSlot(x: ProtoAdapterExposes<typeof f0inputotp.inputOtpSlot>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const character: string = x.character.get();
  const active: boolean = x.active.get();
  const filled: boolean = x.filled.get();
  // @ts-expect-error display character is text, not numerical
  const wrong: number = x.character.get();
  // @ts-expect-error display slot is not another editable input
  x.focusSelf();
}
function f0inputotpSeparator(x: ProtoAdapterExposes<typeof f0inputotp.inputOtpSeparator>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  // @ts-expect-error decorative separator has no focus command
  x.focusSelf();
}
import * as f1slider from '@proto.ui/prototypes-shadcn/slider';
function f1sliderTrack(x: ProtoAdapterExposes<typeof f1slider.sliderTrack>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const value: number = x.value.get();
  const percentage: number = x.percentage.get();
  const direction: string = x.direction.get();
  // @ts-expect-error readout value is numerical
  const wrong: string = x.value.get();
  // @ts-expect-error passive part does not expose thumb focus commands
  x.focusSelf();
}
function f1sliderLabel(x: ProtoAdapterExposes<typeof f1slider.sliderLabel>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const value: number = x.value.get();
  const percentage: number = x.percentage.get();
  const direction: string = x.direction.get();
  // @ts-expect-error readout value is numerical
  const wrong: string = x.value.get();
  // @ts-expect-error passive part does not expose thumb focus commands
  x.focusSelf();
}
function f1sliderIndicator(x: ProtoAdapterExposes<typeof f1slider.sliderIndicator>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const value: number = x.value.get();
  const percentage: number = x.percentage.get();
  const direction: string = x.direction.get();
  // @ts-expect-error readout value is numerical
  const wrong: string = x.value.get();
  // @ts-expect-error passive part does not expose thumb focus commands
  x.focusSelf();
}
function f1sliderValue(x: ProtoAdapterExposes<typeof f1slider.sliderValue>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const value: number = x.value.get();
  const percentage: number = x.percentage.get();
  const direction: string = x.direction.get();
  // @ts-expect-error readout value is numerical
  const wrong: string = x.value.get();
  // @ts-expect-error passive part does not expose thumb focus commands
  x.focusSelf();
}
function f1sliderThumb(x: ProtoAdapterExposes<typeof f1slider.sliderThumb>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const value: number = x.value.get();
  const percentage: number = x.percentage.get();
  const direction: string = x.direction.get();
  // @ts-expect-error readout value is numerical
  const wrong: string = x.value.get();
  x.focusSelf();
  const reset: boolean = x.resetValue();
  const focused: boolean = x.focusVisible.get();
  const hovered: boolean = x.hovered.get();
  const pressed: boolean = x.pressed.get();
  // @ts-expect-error no invented focus parameters
  x.focusSelf('bad');
}
function f1sliderFieldThumb(x: ProtoAdapterExposes<typeof f1slider.sliderFieldThumb>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const value: number = x.value.get();
  const percentage: number = x.percentage.get();
  const direction: string = x.direction.get();
  // @ts-expect-error readout value is numerical
  const wrong: string = x.value.get();
  x.focusSelf();
  const reset: boolean = x.resetValue();
  const focused: boolean = x.focusVisible.get();
  const hovered: boolean = x.hovered.get();
  const pressed: boolean = x.pressed.get();
  // @ts-expect-error no invented focus parameters
  x.focusSelf('bad');
  const invalid: boolean = x.invalid.get();
  const required: boolean = x.fieldRequired.get();
}
import * as f1numberfield from '@proto.ui/prototypes-shadcn/number-field';
function f1numberfieldInput(x: ProtoAdapterExposes<typeof f1numberfield.numberFieldInput>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const value: number = x.value.get();
  const focused: boolean = x.focused.get();
  const reset: boolean = x.resetValue();
  x.focusSelf();
  // @ts-expect-error numeric value is not a string
  const wrong: string = x.value.get();
}
function f1numberfieldControl(x: ProtoAdapterExposes<typeof f1numberfield.numberFieldControl>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const value: number = x.value.get();
  const focused: boolean = x.focused.get();
  const reset: boolean = x.resetValue();
  x.focusSelf();
  // @ts-expect-error numeric value is not a string
  const wrong: string = x.value.get();
  const pending: boolean = x.pending.get();
  const invalid: boolean = x.invalid.get();
}
function f1numberfieldIncrement(x: ProtoAdapterExposes<typeof f1numberfield.numberFieldIncrement>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const disabled: boolean = x.disabled.get();
  const focused: boolean = x.focusVisible.get();
  // @ts-expect-error step button exposes no focusSelf method
  x.focusSelf();
}
function f1numberfieldDecrement(x: ProtoAdapterExposes<typeof f1numberfield.numberFieldDecrement>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const disabled: boolean = x.disabled.get();
  const focused: boolean = x.focusVisible.get();
  // @ts-expect-error step button exposes no focusSelf method
  x.focusSelf();
}
function f1numberfieldLabel(x: ProtoAdapterExposes<typeof f1numberfield.numberFieldLabel>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  // @ts-expect-error passive label has no value owner
  x.value.get();
}
import * as f1inputotp from '@proto.ui/prototypes-shadcn/input-otp';
function f1inputotpInput(x: ProtoAdapterExposes<typeof f1inputotp.inputOtpInput>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const disabled: boolean = x.disabled.get();
  const focused: boolean = x.focusVisible.get();
  const reset: boolean = x.resetValue();
  x.focusSelf();
  // @ts-expect-error editor does not duplicate the Root public value state
  x.value.get();
}
function f1inputotpControl(x: ProtoAdapterExposes<typeof f1inputotp.inputOtpControl>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const disabled: boolean = x.disabled.get();
  const focused: boolean = x.focusVisible.get();
  const reset: boolean = x.resetValue();
  x.focusSelf();
  // @ts-expect-error editor does not duplicate the Root public value state
  x.value.get();
  const pending: boolean = x.pending.get();
  const invalid: boolean = x.invalid.get();
}
function f1inputotpSlot(x: ProtoAdapterExposes<typeof f1inputotp.inputOtpSlot>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const character: string = x.character.get();
  const active: boolean = x.active.get();
  const filled: boolean = x.filled.get();
  // @ts-expect-error display character is text, not numerical
  const wrong: number = x.character.get();
  // @ts-expect-error display slot is not another editable input
  x.focusSelf();
}
function f1inputotpSeparator(x: ProtoAdapterExposes<typeof f1inputotp.inputOtpSeparator>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  // @ts-expect-error decorative separator has no focus command
  x.focusSelf();
}
import * as f2slider from '@proto.ui/prototypes-brutalist/slider';
function f2sliderTrack(x: ProtoAdapterExposes<typeof f2slider.sliderTrack>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const value: number = x.value.get();
  const percentage: number = x.percentage.get();
  const direction: string = x.direction.get();
  // @ts-expect-error readout value is numerical
  const wrong: string = x.value.get();
  // @ts-expect-error passive part does not expose thumb focus commands
  x.focusSelf();
}
function f2sliderLabel(x: ProtoAdapterExposes<typeof f2slider.sliderLabel>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const value: number = x.value.get();
  const percentage: number = x.percentage.get();
  const direction: string = x.direction.get();
  // @ts-expect-error readout value is numerical
  const wrong: string = x.value.get();
  // @ts-expect-error passive part does not expose thumb focus commands
  x.focusSelf();
}
function f2sliderIndicator(x: ProtoAdapterExposes<typeof f2slider.sliderIndicator>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const value: number = x.value.get();
  const percentage: number = x.percentage.get();
  const direction: string = x.direction.get();
  // @ts-expect-error readout value is numerical
  const wrong: string = x.value.get();
  // @ts-expect-error passive part does not expose thumb focus commands
  x.focusSelf();
}
function f2sliderValue(x: ProtoAdapterExposes<typeof f2slider.sliderValue>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const value: number = x.value.get();
  const percentage: number = x.percentage.get();
  const direction: string = x.direction.get();
  // @ts-expect-error readout value is numerical
  const wrong: string = x.value.get();
  // @ts-expect-error passive part does not expose thumb focus commands
  x.focusSelf();
}
function f2sliderThumb(x: ProtoAdapterExposes<typeof f2slider.sliderThumb>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const value: number = x.value.get();
  const percentage: number = x.percentage.get();
  const direction: string = x.direction.get();
  // @ts-expect-error readout value is numerical
  const wrong: string = x.value.get();
  x.focusSelf();
  const reset: boolean = x.resetValue();
  const focused: boolean = x.focusVisible.get();
  const hovered: boolean = x.hovered.get();
  const pressed: boolean = x.pressed.get();
  // @ts-expect-error no invented focus parameters
  x.focusSelf('bad');
}
function f2sliderFieldThumb(x: ProtoAdapterExposes<typeof f2slider.sliderFieldThumb>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const value: number = x.value.get();
  const percentage: number = x.percentage.get();
  const direction: string = x.direction.get();
  // @ts-expect-error readout value is numerical
  const wrong: string = x.value.get();
  x.focusSelf();
  const reset: boolean = x.resetValue();
  const focused: boolean = x.focusVisible.get();
  const hovered: boolean = x.hovered.get();
  const pressed: boolean = x.pressed.get();
  // @ts-expect-error no invented focus parameters
  x.focusSelf('bad');
  const invalid: boolean = x.invalid.get();
  const required: boolean = x.fieldRequired.get();
}
import * as f2numberfield from '@proto.ui/prototypes-brutalist/number-field';
function f2numberfieldInput(x: ProtoAdapterExposes<typeof f2numberfield.numberFieldInput>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const value: number = x.value.get();
  const focused: boolean = x.focused.get();
  const reset: boolean = x.resetValue();
  x.focusSelf();
  // @ts-expect-error numeric value is not a string
  const wrong: string = x.value.get();
}
function f2numberfieldControl(x: ProtoAdapterExposes<typeof f2numberfield.numberFieldControl>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const value: number = x.value.get();
  const focused: boolean = x.focused.get();
  const reset: boolean = x.resetValue();
  x.focusSelf();
  // @ts-expect-error numeric value is not a string
  const wrong: string = x.value.get();
  const pending: boolean = x.pending.get();
  const invalid: boolean = x.invalid.get();
}
function f2numberfieldIncrement(x: ProtoAdapterExposes<typeof f2numberfield.numberFieldIncrement>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const disabled: boolean = x.disabled.get();
  const focused: boolean = x.focusVisible.get();
  // @ts-expect-error step button exposes no focusSelf method
  x.focusSelf();
}
function f2numberfieldDecrement(x: ProtoAdapterExposes<typeof f2numberfield.numberFieldDecrement>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const disabled: boolean = x.disabled.get();
  const focused: boolean = x.focusVisible.get();
  // @ts-expect-error step button exposes no focusSelf method
  x.focusSelf();
}
function f2numberfieldLabel(x: ProtoAdapterExposes<typeof f2numberfield.numberFieldLabel>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  // @ts-expect-error passive label has no value owner
  x.value.get();
}
import * as f2inputotp from '@proto.ui/prototypes-brutalist/input-otp';
function f2inputotpInput(x: ProtoAdapterExposes<typeof f2inputotp.inputOtpInput>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const disabled: boolean = x.disabled.get();
  const focused: boolean = x.focusVisible.get();
  const reset: boolean = x.resetValue();
  x.focusSelf();
  // @ts-expect-error editor does not duplicate the Root public value state
  x.value.get();
}
function f2inputotpControl(x: ProtoAdapterExposes<typeof f2inputotp.inputOtpControl>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const disabled: boolean = x.disabled.get();
  const focused: boolean = x.focusVisible.get();
  const reset: boolean = x.resetValue();
  x.focusSelf();
  // @ts-expect-error editor does not duplicate the Root public value state
  x.value.get();
  const pending: boolean = x.pending.get();
  const invalid: boolean = x.invalid.get();
}
function f2inputotpSlot(x: ProtoAdapterExposes<typeof f2inputotp.inputOtpSlot>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const character: string = x.character.get();
  const active: boolean = x.active.get();
  const filled: boolean = x.filled.get();
  // @ts-expect-error display character is text, not numerical
  const wrong: number = x.character.get();
  // @ts-expect-error display slot is not another editable input
  x.focusSelf();
}
function f2inputotpSeparator(x: ProtoAdapterExposes<typeof f2inputotp.inputOtpSeparator>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  // @ts-expect-error decorative separator has no focus command
  x.focusSelf();
}
import * as f3slider from '@proto.ui/prototypes-bootstrap-2-3-2/slider';
function f3sliderTrack(x: ProtoAdapterExposes<typeof f3slider.sliderTrack>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const value: number = x.value.get();
  const percentage: number = x.percentage.get();
  const direction: string = x.direction.get();
  // @ts-expect-error readout value is numerical
  const wrong: string = x.value.get();
  // @ts-expect-error passive part does not expose thumb focus commands
  x.focusSelf();
}
function f3sliderLabel(x: ProtoAdapterExposes<typeof f3slider.sliderLabel>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const value: number = x.value.get();
  const percentage: number = x.percentage.get();
  const direction: string = x.direction.get();
  // @ts-expect-error readout value is numerical
  const wrong: string = x.value.get();
  // @ts-expect-error passive part does not expose thumb focus commands
  x.focusSelf();
}
function f3sliderIndicator(x: ProtoAdapterExposes<typeof f3slider.sliderIndicator>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const value: number = x.value.get();
  const percentage: number = x.percentage.get();
  const direction: string = x.direction.get();
  // @ts-expect-error readout value is numerical
  const wrong: string = x.value.get();
  // @ts-expect-error passive part does not expose thumb focus commands
  x.focusSelf();
}
function f3sliderValue(x: ProtoAdapterExposes<typeof f3slider.sliderValue>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const value: number = x.value.get();
  const percentage: number = x.percentage.get();
  const direction: string = x.direction.get();
  // @ts-expect-error readout value is numerical
  const wrong: string = x.value.get();
  // @ts-expect-error passive part does not expose thumb focus commands
  x.focusSelf();
}
function f3sliderThumb(x: ProtoAdapterExposes<typeof f3slider.sliderThumb>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const value: number = x.value.get();
  const percentage: number = x.percentage.get();
  const direction: string = x.direction.get();
  // @ts-expect-error readout value is numerical
  const wrong: string = x.value.get();
  x.focusSelf();
  const reset: boolean = x.resetValue();
  const focused: boolean = x.focusVisible.get();
  const hovered: boolean = x.hovered.get();
  const pressed: boolean = x.pressed.get();
  // @ts-expect-error no invented focus parameters
  x.focusSelf('bad');
}
function f3sliderFieldThumb(x: ProtoAdapterExposes<typeof f3slider.sliderFieldThumb>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const value: number = x.value.get();
  const percentage: number = x.percentage.get();
  const direction: string = x.direction.get();
  // @ts-expect-error readout value is numerical
  const wrong: string = x.value.get();
  x.focusSelf();
  const reset: boolean = x.resetValue();
  const focused: boolean = x.focusVisible.get();
  const hovered: boolean = x.hovered.get();
  const pressed: boolean = x.pressed.get();
  // @ts-expect-error no invented focus parameters
  x.focusSelf('bad');
  const invalid: boolean = x.invalid.get();
  const required: boolean = x.fieldRequired.get();
}
import * as f3numberfield from '@proto.ui/prototypes-bootstrap-2-3-2/number-field';
function f3numberfieldInput(x: ProtoAdapterExposes<typeof f3numberfield.numberFieldInput>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const value: number = x.value.get();
  const focused: boolean = x.focused.get();
  const reset: boolean = x.resetValue();
  x.focusSelf();
  // @ts-expect-error numeric value is not a string
  const wrong: string = x.value.get();
}
function f3numberfieldControl(x: ProtoAdapterExposes<typeof f3numberfield.numberFieldControl>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const value: number = x.value.get();
  const focused: boolean = x.focused.get();
  const reset: boolean = x.resetValue();
  x.focusSelf();
  // @ts-expect-error numeric value is not a string
  const wrong: string = x.value.get();
  const pending: boolean = x.pending.get();
  const invalid: boolean = x.invalid.get();
}
function f3numberfieldIncrement(x: ProtoAdapterExposes<typeof f3numberfield.numberFieldIncrement>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const disabled: boolean = x.disabled.get();
  const focused: boolean = x.focusVisible.get();
  // @ts-expect-error step button exposes no focusSelf method
  x.focusSelf();
}
function f3numberfieldDecrement(x: ProtoAdapterExposes<typeof f3numberfield.numberFieldDecrement>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const disabled: boolean = x.disabled.get();
  const focused: boolean = x.focusVisible.get();
  // @ts-expect-error step button exposes no focusSelf method
  x.focusSelf();
}
function f3numberfieldLabel(x: ProtoAdapterExposes<typeof f3numberfield.numberFieldLabel>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  // @ts-expect-error passive label has no value owner
  x.value.get();
}
import * as f3inputotp from '@proto.ui/prototypes-bootstrap-2-3-2/input-otp';
function f3inputotpInput(x: ProtoAdapterExposes<typeof f3inputotp.inputOtpInput>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const disabled: boolean = x.disabled.get();
  const focused: boolean = x.focusVisible.get();
  const reset: boolean = x.resetValue();
  x.focusSelf();
  // @ts-expect-error editor does not duplicate the Root public value state
  x.value.get();
}
function f3inputotpControl(x: ProtoAdapterExposes<typeof f3inputotp.inputOtpControl>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const disabled: boolean = x.disabled.get();
  const focused: boolean = x.focusVisible.get();
  const reset: boolean = x.resetValue();
  x.focusSelf();
  // @ts-expect-error editor does not duplicate the Root public value state
  x.value.get();
  const pending: boolean = x.pending.get();
  const invalid: boolean = x.invalid.get();
}
function f3inputotpSlot(x: ProtoAdapterExposes<typeof f3inputotp.inputOtpSlot>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const character: string = x.character.get();
  const active: boolean = x.active.get();
  const filled: boolean = x.filled.get();
  // @ts-expect-error display character is text, not numerical
  const wrong: number = x.character.get();
  // @ts-expect-error display slot is not another editable input
  x.focusSelf();
}
function f3inputotpSeparator(x: ProtoAdapterExposes<typeof f3inputotp.inputOtpSeparator>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  // @ts-expect-error decorative separator has no focus command
  x.focusSelf();
}
import * as f4slider from '@proto.ui/prototypes-liquid-glass/slider';
function f4sliderTrack(x: ProtoAdapterExposes<typeof f4slider.sliderTrack>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const value: number = x.value.get();
  const percentage: number = x.percentage.get();
  const direction: string = x.direction.get();
  // @ts-expect-error readout value is numerical
  const wrong: string = x.value.get();
  // @ts-expect-error passive part does not expose thumb focus commands
  x.focusSelf();
}
function f4sliderLabel(x: ProtoAdapterExposes<typeof f4slider.sliderLabel>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const value: number = x.value.get();
  const percentage: number = x.percentage.get();
  const direction: string = x.direction.get();
  // @ts-expect-error readout value is numerical
  const wrong: string = x.value.get();
  // @ts-expect-error passive part does not expose thumb focus commands
  x.focusSelf();
}
function f4sliderIndicator(x: ProtoAdapterExposes<typeof f4slider.sliderIndicator>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const value: number = x.value.get();
  const percentage: number = x.percentage.get();
  const direction: string = x.direction.get();
  // @ts-expect-error readout value is numerical
  const wrong: string = x.value.get();
  // @ts-expect-error passive part does not expose thumb focus commands
  x.focusSelf();
}
function f4sliderValue(x: ProtoAdapterExposes<typeof f4slider.sliderValue>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const value: number = x.value.get();
  const percentage: number = x.percentage.get();
  const direction: string = x.direction.get();
  // @ts-expect-error readout value is numerical
  const wrong: string = x.value.get();
  // @ts-expect-error passive part does not expose thumb focus commands
  x.focusSelf();
}
function f4sliderThumb(x: ProtoAdapterExposes<typeof f4slider.sliderThumb>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const value: number = x.value.get();
  const percentage: number = x.percentage.get();
  const direction: string = x.direction.get();
  // @ts-expect-error readout value is numerical
  const wrong: string = x.value.get();
  x.focusSelf();
  const reset: boolean = x.resetValue();
  const focused: boolean = x.focusVisible.get();
  const hovered: boolean = x.hovered.get();
  const pressed: boolean = x.pressed.get();
  // @ts-expect-error no invented focus parameters
  x.focusSelf('bad');
}
function f4sliderFieldThumb(x: ProtoAdapterExposes<typeof f4slider.sliderFieldThumb>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const value: number = x.value.get();
  const percentage: number = x.percentage.get();
  const direction: string = x.direction.get();
  // @ts-expect-error readout value is numerical
  const wrong: string = x.value.get();
  x.focusSelf();
  const reset: boolean = x.resetValue();
  const focused: boolean = x.focusVisible.get();
  const hovered: boolean = x.hovered.get();
  const pressed: boolean = x.pressed.get();
  // @ts-expect-error no invented focus parameters
  x.focusSelf('bad');
  const invalid: boolean = x.invalid.get();
  const required: boolean = x.fieldRequired.get();
}
import * as f4numberfield from '@proto.ui/prototypes-liquid-glass/number-field';
function f4numberfieldInput(x: ProtoAdapterExposes<typeof f4numberfield.numberFieldInput>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const value: number = x.value.get();
  const focused: boolean = x.focused.get();
  const reset: boolean = x.resetValue();
  x.focusSelf();
  // @ts-expect-error numeric value is not a string
  const wrong: string = x.value.get();
}
function f4numberfieldControl(x: ProtoAdapterExposes<typeof f4numberfield.numberFieldControl>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const value: number = x.value.get();
  const focused: boolean = x.focused.get();
  const reset: boolean = x.resetValue();
  x.focusSelf();
  // @ts-expect-error numeric value is not a string
  const wrong: string = x.value.get();
  const pending: boolean = x.pending.get();
  const invalid: boolean = x.invalid.get();
}
function f4numberfieldIncrement(x: ProtoAdapterExposes<typeof f4numberfield.numberFieldIncrement>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const disabled: boolean = x.disabled.get();
  const focused: boolean = x.focusVisible.get();
  // @ts-expect-error step button exposes no focusSelf method
  x.focusSelf();
}
function f4numberfieldDecrement(x: ProtoAdapterExposes<typeof f4numberfield.numberFieldDecrement>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const disabled: boolean = x.disabled.get();
  const focused: boolean = x.focusVisible.get();
  // @ts-expect-error step button exposes no focusSelf method
  x.focusSelf();
}
function f4numberfieldLabel(x: ProtoAdapterExposes<typeof f4numberfield.numberFieldLabel>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  // @ts-expect-error passive label has no value owner
  x.value.get();
}
import * as f4inputotp from '@proto.ui/prototypes-liquid-glass/input-otp';
function f4inputotpInput(x: ProtoAdapterExposes<typeof f4inputotp.inputOtpInput>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const disabled: boolean = x.disabled.get();
  const focused: boolean = x.focusVisible.get();
  const reset: boolean = x.resetValue();
  x.focusSelf();
  // @ts-expect-error editor does not duplicate the Root public value state
  x.value.get();
}
function f4inputotpControl(x: ProtoAdapterExposes<typeof f4inputotp.inputOtpControl>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const disabled: boolean = x.disabled.get();
  const focused: boolean = x.focusVisible.get();
  const reset: boolean = x.resetValue();
  x.focusSelf();
  // @ts-expect-error editor does not duplicate the Root public value state
  x.value.get();
  const pending: boolean = x.pending.get();
  const invalid: boolean = x.invalid.get();
}
function f4inputotpSlot(x: ProtoAdapterExposes<typeof f4inputotp.inputOtpSlot>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  const character: string = x.character.get();
  const active: boolean = x.active.get();
  const filled: boolean = x.filled.get();
  // @ts-expect-error display character is text, not numerical
  const wrong: number = x.character.get();
  // @ts-expect-error display slot is not another editable input
  x.focusSelf();
}
function f4inputotpSeparator(x: ProtoAdapterExposes<typeof f4inputotp.inputOtpSeparator>) {
  // @ts-expect-error no arbitrary index-signature capabilities
  x.notARealExpose;
  // @ts-expect-error decorative separator has no focus command
  x.focusSelf();
}

import { asSliderFieldThumb } from '@proto.ui/prototypes-base/slider';
import { asNumberFieldControl } from '@proto.ui/prototypes-base/number-field';
import { asInputOtpControl } from '@proto.ui/prototypes-base/input-otp';
function borrowedFields(
  slider: ReturnType<typeof asSliderFieldThumb>,
  number: ReturnType<typeof asNumberFieldControl>,
  otp: ReturnType<typeof asInputOtpControl>
) {
  for (const hook of [slider, number, otp]) {
    const child = hook.getAsHookHandle?.('as-field-control');
    if (!child) throw new Error('Public Field binding is required');
    const invalid: boolean = child.state.invalid.get();
    const pending: boolean = child.state.pending.get();
    // @ts-expect-error nested bool state is concrete
    const wrong: string = child.state.pending.get();
  }
  // @ts-expect-error no flattened authored Field validity
  slider.stateHandles!.invalid;
  // @ts-expect-error no flattened authored Field validity
  number.stateHandles!.invalid;
  // @ts-expect-error no flattened authored Field validity
  otp.stateHandles!.invalid;
}
