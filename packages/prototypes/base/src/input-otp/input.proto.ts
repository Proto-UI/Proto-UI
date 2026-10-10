import { FIELD_LABEL_PAIR } from '../field/shared';
import { asFieldControl } from '../field/control-binding.proto';
import type { State } from '@proto.ui/core';
import { defineAsHook, definePrototype, type DefHandle, type RunHandle } from '@proto.ui/core';
import { asAccessible, asFocusable, asTextControl, asControlLabel } from '@proto.ui/hooks';
import { declareTextControl } from '@proto.ui/module-text-control';
import { INPUT_OTP_CONTEXT, INPUT_OTP_FAMILY, otpMethod } from './shared';
import type { InputOtpInputProps } from './types';
export function setupInputOtpInput(def: DefHandle<InputOtpInputProps>, field = false) {
  const binding = field ? asFieldControl() : null;
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
  if (binding)
    asControlLabel().target((_run, request) => {
      if (!disabled.get() && request.isCurrent())
        focus.focusSelf({ reason: request.source === 'pointer' ? 'pointer' : 'programmatic' });
    }, FIELD_LABEL_PAIR);
  const a = asAccessible();
  a.role('textbox');
  a.name(label);
  a.state('disabled', disabled);
  a.state('readOnly', readOnly);
  const sync = (run: RunHandle<InputOtpInputProps>) => {
    const c = run.context.read(INPUT_OTP_CONTEXT);
    binding?.setPolicy({ disabled: c.controlDisabled, readOnly: c.controlReadOnly });
    disabled.set(c.disabled, 'reason: OTP editor policy');
    readOnly.set(c.readOnly, 'reason: OTP editor policy');
    label.set(c.label, 'reason: OTP editor name');
    focus.setDisabled(c.disabled);
    binding?.report({
      value: c.value,
      focused: focus.focused.get(),
      composing: control.snapshot()?.composing ?? false,
      reason: 'sync',
    });
    control.sync({
      valueMode: 'controlled',
      value: c.value,
      disabled: c.disabled,
      readOnly: c.readOnly,
      name: c.name,
      required: binding?.state.fieldRequired.get() ?? false,
      autoComplete: 'one-time-code',
      inputMode: c.pattern === 'numeric' ? 'numeric' : 'text',
      maxLength: c.length,
      placeholder: run.props.get().placeholder ?? '',
    });
  };
  let currentRun: RunHandle<InputOtpInputProps> | null = null;
  def.lifecycle.onMounted((run) => {
    currentRun = run;
  });
  def.lifecycle.onUnmounted(() => {
    currentRun = null;
  });
  def.expose.method('resetValue', () => {
    if (!currentRun) return false;
    control.resetValue();
    return otpMethod(currentRun, 'resetValue');
  });
  def.expose.method(
    '__implicitSubmitEligible',
    () => focus.focused.get() && !control.snapshot()?.composing
  );
  def.context.subscribe(INPUT_OTP_CONTEXT, sync);
  def.lifecycle.onCreated(sync);
  def.props.watchAll(sync);
  control.on('compositionstart', (run) => {
    binding?.report({
      value: run.context.read(INPUT_OTP_CONTEXT).value,
      focused: focus.focused.get(),
      composing: true,
      reason: 'sync',
    });
  });
  control.on('input', (run, e) => {
    if (!e.composing) {
      otpMethod(run, 'requestValue', e.value);
      sync(run);
      binding?.report({
        value: run.context.read(INPUT_OTP_CONTEXT).value,
        focused: focus.focused.get(),
        composing: e.composing,
        reason: 'input',
      });
    }
  });
  control.on('compositionend', (run, e) => {
    otpMethod(run, 'requestValue', e.value);
    sync(run);
    binding?.report({
      value: run.context.read(INPUT_OTP_CONTEXT).value,
      focused: focus.focused.get(),
      composing: false,
      reason: 'compositionend',
    });
  });
  focus.focused.watch((run, e) => {
    if (e.type === 'next') {
      otpMethod(run, '__focus', e.next);
      binding?.report({
        value: run.context.read(INPUT_OTP_CONTEXT).value,
        focused: e.next,
        composing: control.snapshot()?.composing ?? false,
        reason: e.next ? 'sync' : 'blur',
      });
    }
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
  setup: setupInputOtpInput,
});
export default definePrototype({
  name: 'base-input-otp-input',
  modules: asInputOtpInput.modules,
  setup: setupInputOtpInput,
});
