/** Compile-only real consumer capabilities plus Base/family parity and negative contracts. */
import type { Prototype, ExposeOf } from '@proto.ui/core';
import type { ProtoAdapterExposes } from '@proto.ui/adapter-base';
type PropsOf<T> = T extends Prototype<infer P, any> ? P : never;
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;
type Surface<T> = {
  [K in keyof T as T[K] extends Prototype<any, any> ? K : never]: readonly [
    PropsOf<T[K]>,
    ExposeOf<T[K]>,
  ];
};
import * as basefieldset from '../src/fieldset';
import * as baseform from '../src/form';
import * as basecheckboxgroup from '../src/checkbox-group';
import * as baseslider from '../src/slider';
import * as basenumberfield from '../src/number-field';
import * as baseinputotp from '../src/input-otp';
import * as f0fieldset from '../../shadcn/src/fieldset';
type f0fieldsetSurface = Assert<Equal<Surface<typeof f0fieldset>, Surface<typeof basefieldset>>>;
// @ts-expect-error canonical Base prop domain is retained
const f0fieldsetBad: PropsOf<typeof f0fieldset.fieldsetRoot> = { disabled: 'wrong' };
void f0fieldsetBad;
import * as f0form from '../../shadcn/src/form';
type f0formSurface = Assert<Equal<Surface<typeof f0form>, Surface<typeof baseform>>>;
// @ts-expect-error canonical Base prop domain is retained
const f0formBad: PropsOf<typeof f0form.formRoot> = { disabled: 'wrong' };
void f0formBad;
import * as f0checkboxgroup from '../../shadcn/src/checkbox-group';
type f0checkboxgroupSurface = Assert<
  Equal<Surface<typeof f0checkboxgroup>, Surface<typeof basecheckboxgroup>>
>;
// @ts-expect-error canonical Base prop domain is retained
const f0checkboxgroupBad: PropsOf<typeof f0checkboxgroup.checkboxGroupRoot> = { value: 1 };
void f0checkboxgroupBad;
import * as f0slider from '../../shadcn/src/slider';
type f0sliderSurface = Assert<Equal<Surface<typeof f0slider>, Surface<typeof baseslider>>>;
// @ts-expect-error canonical Base prop domain is retained
const f0sliderBad: PropsOf<typeof f0slider.sliderRoot> = { value: 'wrong' };
void f0sliderBad;
import * as f0numberfield from '../../shadcn/src/number-field';
type f0numberfieldSurface = Assert<
  Equal<Surface<typeof f0numberfield>, Surface<typeof basenumberfield>>
>;
// @ts-expect-error canonical Base prop domain is retained
const f0numberfieldBad: PropsOf<typeof f0numberfield.numberFieldRoot> = { value: 'wrong' };
void f0numberfieldBad;
import * as f0inputotp from '../../shadcn/src/input-otp';
type f0inputotpSurface = Assert<Equal<Surface<typeof f0inputotp>, Surface<typeof baseinputotp>>>;
// @ts-expect-error canonical Base prop domain is retained
const f0inputotpBad: PropsOf<typeof f0inputotp.inputOtpRoot> = { value: 23 };
void f0inputotpBad;
function f0Methods(
  form: ProtoAdapterExposes<typeof f0form.formRoot>,
  number: ProtoAdapterExposes<typeof f0numberfield.numberFieldRoot>,
  group: ProtoAdapterExposes<typeof f0checkboxgroup.checkboxGroupRoot>
) {
  const result: boolean = form.requestReset();
  const value: number = number.value.get();
  const values: string[] = group.getValue();
  // @ts-expect-error reset takes no proposed value
  form.requestReset('bad');
  // @ts-expect-error numeric root accepts numbers
  number.requestValue('bad');
  // @ts-expect-error a canonical group is a string array
  const invalid: number = group.getValue();
  return [result, value, values, invalid];
}
void f0Methods;
import * as f1fieldset from '../../brutalist/src/fieldset';
type f1fieldsetSurface = Assert<Equal<Surface<typeof f1fieldset>, Surface<typeof basefieldset>>>;
// @ts-expect-error canonical Base prop domain is retained
const f1fieldsetBad: PropsOf<typeof f1fieldset.fieldsetRoot> = { disabled: 'wrong' };
void f1fieldsetBad;
import * as f1form from '../../brutalist/src/form';
type f1formSurface = Assert<Equal<Surface<typeof f1form>, Surface<typeof baseform>>>;
// @ts-expect-error canonical Base prop domain is retained
const f1formBad: PropsOf<typeof f1form.formRoot> = { disabled: 'wrong' };
void f1formBad;
import * as f1checkboxgroup from '../../brutalist/src/checkbox-group';
type f1checkboxgroupSurface = Assert<
  Equal<Surface<typeof f1checkboxgroup>, Surface<typeof basecheckboxgroup>>
>;
// @ts-expect-error canonical Base prop domain is retained
const f1checkboxgroupBad: PropsOf<typeof f1checkboxgroup.checkboxGroupRoot> = { value: 1 };
void f1checkboxgroupBad;
import * as f1slider from '../../brutalist/src/slider';
type f1sliderSurface = Assert<Equal<Surface<typeof f1slider>, Surface<typeof baseslider>>>;
// @ts-expect-error canonical Base prop domain is retained
const f1sliderBad: PropsOf<typeof f1slider.sliderRoot> = { value: 'wrong' };
void f1sliderBad;
import * as f1numberfield from '../../brutalist/src/number-field';
type f1numberfieldSurface = Assert<
  Equal<Surface<typeof f1numberfield>, Surface<typeof basenumberfield>>
>;
// @ts-expect-error canonical Base prop domain is retained
const f1numberfieldBad: PropsOf<typeof f1numberfield.numberFieldRoot> = { value: 'wrong' };
void f1numberfieldBad;
import * as f1inputotp from '../../brutalist/src/input-otp';
type f1inputotpSurface = Assert<Equal<Surface<typeof f1inputotp>, Surface<typeof baseinputotp>>>;
// @ts-expect-error canonical Base prop domain is retained
const f1inputotpBad: PropsOf<typeof f1inputotp.inputOtpRoot> = { value: 23 };
void f1inputotpBad;
function f1Methods(
  form: ProtoAdapterExposes<typeof f1form.formRoot>,
  number: ProtoAdapterExposes<typeof f1numberfield.numberFieldRoot>,
  group: ProtoAdapterExposes<typeof f1checkboxgroup.checkboxGroupRoot>
) {
  const result: boolean = form.requestReset();
  const value: number = number.value.get();
  const values: string[] = group.getValue();
  // @ts-expect-error reset takes no proposed value
  form.requestReset('bad');
  // @ts-expect-error numeric root accepts numbers
  number.requestValue('bad');
  // @ts-expect-error a canonical group is a string array
  const invalid: number = group.getValue();
  return [result, value, values, invalid];
}
void f1Methods;
import * as f2fieldset from '../../bootstrap-2-3-2/src/fieldset';
type f2fieldsetSurface = Assert<Equal<Surface<typeof f2fieldset>, Surface<typeof basefieldset>>>;
// @ts-expect-error canonical Base prop domain is retained
const f2fieldsetBad: PropsOf<typeof f2fieldset.fieldsetRoot> = { disabled: 'wrong' };
void f2fieldsetBad;
import * as f2form from '../../bootstrap-2-3-2/src/form';
type f2formSurface = Assert<Equal<Surface<typeof f2form>, Surface<typeof baseform>>>;
// @ts-expect-error canonical Base prop domain is retained
const f2formBad: PropsOf<typeof f2form.formRoot> = { disabled: 'wrong' };
void f2formBad;
import * as f2checkboxgroup from '../../bootstrap-2-3-2/src/checkbox-group';
type f2checkboxgroupSurface = Assert<
  Equal<Surface<typeof f2checkboxgroup>, Surface<typeof basecheckboxgroup>>
>;
// @ts-expect-error canonical Base prop domain is retained
const f2checkboxgroupBad: PropsOf<typeof f2checkboxgroup.checkboxGroupRoot> = { value: 1 };
void f2checkboxgroupBad;
import * as f2slider from '../../bootstrap-2-3-2/src/slider';
type f2sliderSurface = Assert<Equal<Surface<typeof f2slider>, Surface<typeof baseslider>>>;
// @ts-expect-error canonical Base prop domain is retained
const f2sliderBad: PropsOf<typeof f2slider.sliderRoot> = { value: 'wrong' };
void f2sliderBad;
import * as f2numberfield from '../../bootstrap-2-3-2/src/number-field';
type f2numberfieldSurface = Assert<
  Equal<Surface<typeof f2numberfield>, Surface<typeof basenumberfield>>
>;
// @ts-expect-error canonical Base prop domain is retained
const f2numberfieldBad: PropsOf<typeof f2numberfield.numberFieldRoot> = { value: 'wrong' };
void f2numberfieldBad;
import * as f2inputotp from '../../bootstrap-2-3-2/src/input-otp';
type f2inputotpSurface = Assert<Equal<Surface<typeof f2inputotp>, Surface<typeof baseinputotp>>>;
// @ts-expect-error canonical Base prop domain is retained
const f2inputotpBad: PropsOf<typeof f2inputotp.inputOtpRoot> = { value: 23 };
void f2inputotpBad;
function f2Methods(
  form: ProtoAdapterExposes<typeof f2form.formRoot>,
  number: ProtoAdapterExposes<typeof f2numberfield.numberFieldRoot>,
  group: ProtoAdapterExposes<typeof f2checkboxgroup.checkboxGroupRoot>
) {
  const result: boolean = form.requestReset();
  const value: number = number.value.get();
  const values: string[] = group.getValue();
  // @ts-expect-error reset takes no proposed value
  form.requestReset('bad');
  // @ts-expect-error numeric root accepts numbers
  number.requestValue('bad');
  // @ts-expect-error a canonical group is a string array
  const invalid: number = group.getValue();
  return [result, value, values, invalid];
}
void f2Methods;
import * as f3fieldset from '../../liquid-glass/src/fieldset';
type f3fieldsetSurface = Assert<Equal<Surface<typeof f3fieldset>, Surface<typeof basefieldset>>>;
// @ts-expect-error canonical Base prop domain is retained
const f3fieldsetBad: PropsOf<typeof f3fieldset.fieldsetRoot> = { disabled: 'wrong' };
void f3fieldsetBad;
import * as f3form from '../../liquid-glass/src/form';
type f3formSurface = Assert<
  Equal<
    Surface<Omit<typeof f3form, 'formSubmit' | 'formReset'>>,
    Surface<Omit<typeof baseform, 'formSubmit' | 'formReset'>>
  >
>;
type LiquidActionProps = { disabled?: boolean; material?: 'auto' | 'opaque' };
type LiquidSubmitProps = Assert<Equal<PropsOf<typeof f3form.formSubmit>, LiquidActionProps>>;
type LiquidResetProps = Assert<Equal<PropsOf<typeof f3form.formReset>, LiquidActionProps>>;
type LiquidSubmitExposes = Assert<
  Equal<ExposeOf<typeof f3form.formSubmit>, ExposeOf<typeof baseform.formSubmit>>
>;
type LiquidResetExposes = Assert<
  Equal<ExposeOf<typeof f3form.formReset>, ExposeOf<typeof baseform.formReset>>
>;
// @ts-expect-error material preference is a finite family-owned domain
const badMaterial: PropsOf<typeof f3form.formSubmit> = { material: 'transparent' };
void badMaterial;
// @ts-expect-error canonical Base prop domain is retained
const f3formBad: PropsOf<typeof f3form.formRoot> = { disabled: 'wrong' };
void f3formBad;
import * as f3checkboxgroup from '../../liquid-glass/src/checkbox-group';
type f3checkboxgroupSurface = Assert<
  Equal<Surface<typeof f3checkboxgroup>, Surface<typeof basecheckboxgroup>>
>;
// @ts-expect-error canonical Base prop domain is retained
const f3checkboxgroupBad: PropsOf<typeof f3checkboxgroup.checkboxGroupRoot> = { value: 1 };
void f3checkboxgroupBad;
import * as f3slider from '../../liquid-glass/src/slider';
type f3sliderSurface = Assert<Equal<Surface<typeof f3slider>, Surface<typeof baseslider>>>;
// @ts-expect-error canonical Base prop domain is retained
const f3sliderBad: PropsOf<typeof f3slider.sliderRoot> = { value: 'wrong' };
void f3sliderBad;
import * as f3numberfield from '../../liquid-glass/src/number-field';
type f3numberfieldSurface = Assert<
  Equal<Surface<typeof f3numberfield>, Surface<typeof basenumberfield>>
>;
// @ts-expect-error canonical Base prop domain is retained
const f3numberfieldBad: PropsOf<typeof f3numberfield.numberFieldRoot> = { value: 'wrong' };
void f3numberfieldBad;
import * as f3inputotp from '../../liquid-glass/src/input-otp';
type f3inputotpSurface = Assert<Equal<Surface<typeof f3inputotp>, Surface<typeof baseinputotp>>>;
// @ts-expect-error canonical Base prop domain is retained
const f3inputotpBad: PropsOf<typeof f3inputotp.inputOtpRoot> = { value: 23 };
void f3inputotpBad;
function f3Methods(
  form: ProtoAdapterExposes<typeof f3form.formRoot>,
  number: ProtoAdapterExposes<typeof f3numberfield.numberFieldRoot>,
  group: ProtoAdapterExposes<typeof f3checkboxgroup.checkboxGroupRoot>
) {
  const result: boolean = form.requestReset();
  const value: number = number.value.get();
  const values: string[] = group.getValue();
  // @ts-expect-error reset takes no proposed value
  form.requestReset('bad');
  // @ts-expect-error numeric root accepts numbers
  number.requestValue('bad');
  // @ts-expect-error a canonical group is a string array
  const invalid: number = group.getValue();
  return [result, value, values, invalid];
}
void f3Methods;

function baseformSubmitAction(a: ProtoAdapterExposes<typeof baseform.formSubmit>) {
  const focus: boolean = a.focusVisible.get();
  const hover: boolean = a.hovered.get();
  const disabled: boolean = a.disabled.get();
  const pressed: boolean = a.pressed.get();
  a.focusSelf({ reason: 'programmatic' });
  // @ts-expect-error action state is boolean, not string
  const bad: string = a.focusVisible.get();
  // @ts-expect-error action does not expose arbitrary methods
  a.invented();
  return [focus, hover, disabled, pressed, bad];
}
void baseformSubmitAction;

function baseformResetAction(a: ProtoAdapterExposes<typeof baseform.formReset>) {
  const focus: boolean = a.focusVisible.get();
  const hover: boolean = a.hovered.get();
  const disabled: boolean = a.disabled.get();
  const pressed: boolean = a.pressed.get();
  a.focusSelf({ reason: 'programmatic' });
  // @ts-expect-error action state is boolean, not string
  const bad: string = a.focusVisible.get();
  // @ts-expect-error action does not expose arbitrary methods
  a.invented();
  return [focus, hover, disabled, pressed, bad];
}
void baseformResetAction;

function f0formSubmitAction(a: ProtoAdapterExposes<typeof f0form.formSubmit>) {
  const focus: boolean = a.focusVisible.get();
  const hover: boolean = a.hovered.get();
  const disabled: boolean = a.disabled.get();
  const pressed: boolean = a.pressed.get();
  a.focusSelf({ reason: 'programmatic' });
  // @ts-expect-error action state is boolean, not string
  const bad: string = a.focusVisible.get();
  // @ts-expect-error action does not expose arbitrary methods
  a.invented();
  return [focus, hover, disabled, pressed, bad];
}
void f0formSubmitAction;

function f0formResetAction(a: ProtoAdapterExposes<typeof f0form.formReset>) {
  const focus: boolean = a.focusVisible.get();
  const hover: boolean = a.hovered.get();
  const disabled: boolean = a.disabled.get();
  const pressed: boolean = a.pressed.get();
  a.focusSelf({ reason: 'programmatic' });
  // @ts-expect-error action state is boolean, not string
  const bad: string = a.focusVisible.get();
  // @ts-expect-error action does not expose arbitrary methods
  a.invented();
  return [focus, hover, disabled, pressed, bad];
}
void f0formResetAction;

function f1formSubmitAction(a: ProtoAdapterExposes<typeof f1form.formSubmit>) {
  const focus: boolean = a.focusVisible.get();
  const hover: boolean = a.hovered.get();
  const disabled: boolean = a.disabled.get();
  const pressed: boolean = a.pressed.get();
  a.focusSelf({ reason: 'programmatic' });
  // @ts-expect-error action state is boolean, not string
  const bad: string = a.focusVisible.get();
  // @ts-expect-error action does not expose arbitrary methods
  a.invented();
  return [focus, hover, disabled, pressed, bad];
}
void f1formSubmitAction;

function f1formResetAction(a: ProtoAdapterExposes<typeof f1form.formReset>) {
  const focus: boolean = a.focusVisible.get();
  const hover: boolean = a.hovered.get();
  const disabled: boolean = a.disabled.get();
  const pressed: boolean = a.pressed.get();
  a.focusSelf({ reason: 'programmatic' });
  // @ts-expect-error action state is boolean, not string
  const bad: string = a.focusVisible.get();
  // @ts-expect-error action does not expose arbitrary methods
  a.invented();
  return [focus, hover, disabled, pressed, bad];
}
void f1formResetAction;

function f2formSubmitAction(a: ProtoAdapterExposes<typeof f2form.formSubmit>) {
  const focus: boolean = a.focusVisible.get();
  const hover: boolean = a.hovered.get();
  const disabled: boolean = a.disabled.get();
  const pressed: boolean = a.pressed.get();
  a.focusSelf({ reason: 'programmatic' });
  // @ts-expect-error action state is boolean, not string
  const bad: string = a.focusVisible.get();
  // @ts-expect-error action does not expose arbitrary methods
  a.invented();
  return [focus, hover, disabled, pressed, bad];
}
void f2formSubmitAction;

function f2formResetAction(a: ProtoAdapterExposes<typeof f2form.formReset>) {
  const focus: boolean = a.focusVisible.get();
  const hover: boolean = a.hovered.get();
  const disabled: boolean = a.disabled.get();
  const pressed: boolean = a.pressed.get();
  a.focusSelf({ reason: 'programmatic' });
  // @ts-expect-error action state is boolean, not string
  const bad: string = a.focusVisible.get();
  // @ts-expect-error action does not expose arbitrary methods
  a.invented();
  return [focus, hover, disabled, pressed, bad];
}
void f2formResetAction;

function f3formSubmitAction(a: ProtoAdapterExposes<typeof f3form.formSubmit>) {
  const focus: boolean = a.focusVisible.get();
  const hover: boolean = a.hovered.get();
  const disabled: boolean = a.disabled.get();
  const pressed: boolean = a.pressed.get();
  a.focusSelf({ reason: 'programmatic' });
  // @ts-expect-error action state is boolean, not string
  const bad: string = a.focusVisible.get();
  // @ts-expect-error action does not expose arbitrary methods
  a.invented();
  return [focus, hover, disabled, pressed, bad];
}
void f3formSubmitAction;

function f3formResetAction(a: ProtoAdapterExposes<typeof f3form.formReset>) {
  const focus: boolean = a.focusVisible.get();
  const hover: boolean = a.hovered.get();
  const disabled: boolean = a.disabled.get();
  const pressed: boolean = a.pressed.get();
  a.focusSelf({ reason: 'programmatic' });
  // @ts-expect-error action state is boolean, not string
  const bad: string = a.focusVisible.get();
  // @ts-expect-error action does not expose arbitrary methods
  a.invented();
  return [focus, hover, disabled, pressed, bad];
}
void f3formResetAction;

// Hook consumers need typed borrowed handles as well as typed adapter exposes.
function formActionHookConsumer() {
  for (const hook of [baseform.asFormSubmit, baseform.asFormReset]) {
    const result = hook();
    const focused: boolean = result.stateHandles!.focusVisible.get();
    const pressed: boolean = result.stateHandles!.pressed.get();
    // @ts-expect-error borrowed state is boolean, not string
    const bad: string = result.stateHandles!.disabled.get();
    // @ts-expect-error no invented borrowed state
    result.stateHandles!.invented.get();
    void [focused, pressed, bad];
  }
}
void formActionHookConsumer;
