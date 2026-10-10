import type { State } from '@proto.ui/core';
import { defineAsHook, definePrototype, type DefHandle, type RunHandle } from '@proto.ui/core';
import { asAccessible, asFocusable, asTextControl } from '@proto.ui/hooks';
import { declareTextControl } from '@proto.ui/module-text-control';
import { INPUT_OTP_CONTEXT, INPUT_OTP_FAMILY, otpMethod } from './shared';
import type { InputOtpInputProps } from './types';
function setup(def: DefHandle<InputOtpInputProps>) {
  def.anatomy.claim(INPUT_OTP_FAMILY, { role: 'input' });
  def.props.define({ placeholder: { type: 'string', empty: 'fallback' } });
  const control = asTextControl<InputOtpInputProps, 'single'>(),
    focus = asFocusable<InputOtpInputProps>();
  focus.configure({ disabled: false });
  const disabled = def.state.bool('disabled', false),
    readOnly = def.state.bool('readOnly', false),
    label = def.state.string('label', '');
  def.expose.state('disabled', disabled);
  def.expose.state('focusVisible', focus.focusVisible);
  def.expose.method('focusSelf', () => {
    if (!disabled.get()) focus.focusSelf();
  });
  const a = asAccessible();
  a.role('textbox');
  a.name(label);
  a.state('disabled', disabled);
  a.state('readOnly', readOnly);
  const sync = (run: RunHandle<InputOtpInputProps>) => {
    const c = run.context.read(INPUT_OTP_CONTEXT);
    disabled.set(c.disabled, 'reason: OTP editor policy');
    readOnly.set(c.readOnly, 'reason: OTP editor policy');
    label.set(c.label, 'reason: OTP editor name');
    focus.setDisabled(c.disabled);
    control.sync({
      valueMode: 'controlled',
      value: c.value,
      disabled: c.disabled,
      readOnly: c.readOnly,
      name: c.name,
      autoComplete: 'one-time-code',
      inputMode: c.pattern === 'numeric' ? 'numeric' : 'text',
      maxLength: c.length,
      placeholder: run.props.get().placeholder ?? '',
    });
  };
  def.context.subscribe(INPUT_OTP_CONTEXT, sync);
  def.lifecycle.onCreated(sync);
  def.props.watchAll(sync);
  control.on('input', (run, e) => {
    if (!e.composing) {
      otpMethod(run, 'requestValue', e.value);
      sync(run);
    }
  });
  control.on('compositionend', (run, e) => {
    otpMethod(run, 'requestValue', e.value);
    sync(run);
  });
  focus.focused.watch((run, e) => {
    if (e.type === 'next') otpMethod(run, '__focus', e.next);
  });
  return () => null;
}
export const asInputOtpInput = defineAsHook<
  InputOtpInputProps,
  Record<string, unknown>,
  { state: { disabled: State<boolean>; focusVisible: State<boolean> } }
>({
  name: 'as-input-otp-input',
  modules: [declareTextControl({ content: 'plain-text', lineMode: 'single', engine: 'host' })],
  setup,
});
export default definePrototype({
  name: 'base-input-otp-input',
  modules: asInputOtpInput.modules,
  setup,
});
