import type { InputOtpInputExposes } from './types';
import { FIELD_LABEL_PAIR } from '../field/shared';
import { asFieldControl } from '../field/control-binding.proto';
import type { ObservedStateHandle, State } from '@proto.ui/core';
import {
  defineAsHook,
  definePrototype,
  delay,
  type DelayTask,
  type DefHandle,
  type RunHandle,
} from '@proto.ui/core';
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
  let currentRun: RunHandle<InputOtpInputProps> | null = null;
  let reportEpoch = 0;
  let fieldTask: DelayTask | null = null;
  let fieldBaseline: string | null = null;
  const cancelReports = () => {
    reportEpoch++;
    fieldTask?.cancel();
    fieldTask = null;
    fieldBaseline = null;
  };
  const reportEdit = (before: string, reason: 'input' | 'compositionend') => {
    if (!binding || !currentRun) return;
    const current = currentRun,
      epoch = ++reportEpoch;
    fieldBaseline ??= before;
    fieldTask?.cancel();
    // Outward callbacks can accept several edits in one turn. Validate the
    // latest owner snapshot once, relative to the first pending edit, after
    // those callbacks. A rejected later candidate cannot erase an earlier
    // accepted change or turn the unchanged canonical value into an edit.
    fieldTask = delay(0, () => {
      if (currentRun !== current || reportEpoch !== epoch) return;
      const baseline = fieldBaseline;
      fieldTask = null;
      fieldBaseline = null;
      const value = current.context.read(INPUT_OTP_CONTEXT).value;
      binding.report({
        value,
        focused: focus.focused.get(),
        composing: control.snapshot()?.composing ?? false,
        reason: value === baseline ? 'sync' : reason,
      });
    });
  };
  const syncSelection = (run: RunHandle<InputOtpInputProps>) => {
    const snapshot = control.snapshot();
    otpMethod(run, '__selection', snapshot?.selection ?? null, snapshot?.value ?? '');
  };
  const sync = (run: RunHandle<InputOtpInputProps>) => {
    const c = run.context.read(INPUT_OTP_CONTEXT);
    if (disabled.get() !== c.disabled || readOnly.get() !== c.readOnly) cancelReports();
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
    syncSelection(run);
  };
  def.lifecycle.onMounted((run) => {
    currentRun = run;
    syncSelection(run);
  });
  def.lifecycle.onUnmounted(() => {
    currentRun = null;
    cancelReports();
  });
  def.lifecycle.onBeforeDispose(() => {
    currentRun = null;
    cancelReports();
  });
  def.expose.method('__resetEditor', () => {
    if (!currentRun) return false;
    cancelReports();
    control.resetValue();
    return true;
  });
  def.expose.method('resetValue', () => (currentRun ? otpMethod(currentRun, 'resetValue') : false));
  def.expose.method(
    '__implicitSubmitEligible',
    () => focus.focused.get() && !control.snapshot()?.composing
  );
  def.context.subscribe(INPUT_OTP_CONTEXT, sync);
  def.lifecycle.onCreated(sync);
  def.props.watchAll(sync);
  control.on('selectionchange', (run, event) => {
    otpMethod(run, '__selection', event.selection ?? null, event.value);
  });
  control.on('compositionstart', (run) => {
    cancelReports();
    binding?.report({
      value: run.context.read(INPUT_OTP_CONTEXT).value,
      focused: focus.focused.get(),
      composing: true,
      reason: 'sync',
    });
  });
  control.on('input', (run, e) => {
    if (!e.composing) {
      const before = run.context.read(INPUT_OTP_CONTEXT).value;
      otpMethod(run, 'requestValue', e.value);
      if (currentRun !== run) return;
      sync(run);
      if (currentRun === run) reportEdit(before, 'input');
    }
  });
  control.on('compositionend', (run, e) => {
    const before = run.context.read(INPUT_OTP_CONTEXT).value;
    otpMethod(run, 'requestValue', e.value);
    if (currentRun !== run) return;
    sync(run);
    if (currentRun === run) reportEdit(before, 'compositionend');
  });
  focus.focused.watch((run, e) => {
    if (e.type === 'next') {
      otpMethod(run, '__focus', e.next);
      if (e.next) syncSelection(run);
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
  InputOtpInputExposes,
  {
    state: {
      disabled: State<boolean>;
      focusVisible: ObservedStateHandle<boolean, InputOtpInputProps>;
    };
  }
>({
  name: 'as-input-otp-input',
  modules: [declareTextControl({ content: 'plain-text', lineMode: 'single', engine: 'host' })],
  setup: setupInputOtpInput,
});
export default definePrototype<InputOtpInputProps, InputOtpInputExposes>({
  name: 'base-input-otp-input',
  modules: asInputOtpInput.modules,
  setup: setupInputOtpInput,
});
