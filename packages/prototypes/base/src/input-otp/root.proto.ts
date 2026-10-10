import {
  defineAsHook,
  definePrototype,
  type DefHandle,
  type RunHandle,
  type RendererHandle,
} from '@proto.ui/core';
import { INPUT_OTP_CONTEXT, INPUT_OTP_FAMILY, normalizeOtp } from './shared';
import type { InputOtpRootProps, InputOtpRootExposes, InputOtpRootAsHookContract } from './types';
function setup(def: DefHandle<InputOtpRootProps, InputOtpRootExposes>) {
  def.anatomy.claim(INPUT_OTP_FAMILY, { role: 'root' });
  def.props.define({
    value: { type: 'string', empty: 'fallback' },
    defaultValue: { type: 'string', empty: 'fallback' },
    length: {
      type: 'number',
      empty: 'fallback',
      validator: (v) => Number.isInteger(v) && v >= 1 && v <= 32,
    },
    pattern: { type: 'enum', empty: 'fallback', options: ['numeric', 'alphanumeric'] },
    disabled: { type: 'boolean', empty: 'fallback' },
    readOnly: { type: 'boolean', empty: 'fallback' },
    name: { type: 'string', empty: 'fallback' },
    ariaLabel: { type: 'string', empty: 'fallback' },
  });
  def.props.setDefaults({
    defaultValue: '',
    length: 6,
    pattern: 'numeric',
    disabled: false,
    readOnly: false,
    name: '',
    ariaLabel: 'One-time code',
  });
  const value = def.state.string('value', ''),
    complete = def.state.bool('complete', false),
    disabled = def.state.bool('disabled', false),
    readOnly = def.state.bool('readOnly', false),
    focused = def.state.bool('focused', false);
  def.expose.state('value', value);
  def.expose.state('complete', complete);
  def.expose.state('disabled', disabled);
  def.expose.state('readOnly', readOnly);
  def.expose.state('focused', focused);
  def.expose.event('valueChange', { payload: 'json' });
  def.expose.event('completed', { payload: 'json' });
  def.context.provide(INPUT_OTP_CONTEXT, {
    value: '',
    length: 6,
    disabled: false,
    readOnly: false,
    complete: false,
    pattern: 'numeric',
    name: '',
    label: 'One-time code',
    focused: false,
  });
  let run: RunHandle<InputOtpRootProps> | null = null,
    lastComplete = '';
  const normalize = (text: string) =>
    normalizeOtp(text, run?.props.get().length ?? 6, run?.props.get().pattern ?? 'numeric');
  const publish = () => {
    if (!run) return;
    const p = run.props.get();
    disabled.set(!!p.disabled, 'reason: OTP policy');
    readOnly.set(!!p.readOnly, 'reason: OTP policy');
    complete.set(value.get().length === (p.length ?? 6), 'reason: OTP completion');
    if (!complete.get()) lastComplete = '';
    run.context.update(INPUT_OTP_CONTEXT, {
      value: value.get(),
      length: p.length ?? 6,
      disabled: disabled.get(),
      readOnly: readOnly.get(),
      complete: complete.get(),
      pattern: p.pattern ?? 'numeric',
      name: p.name ?? '',
      label: p.ariaLabel ?? 'One-time code',
      focused: focused.get(),
    });
  };
  const request = (next: string) => {
    if (!run || disabled.get() || readOnly.get() || typeof next !== 'string') return false;
    next = normalize(next);
    if (next === value.get()) {
      publish();
      return false;
    }
    if (!run.props.isProvided('value')) value.set(next, 'reason: OTP accepted input');
    publish();
    run.expose.emit('valueChange', { value: next });
    if (complete.get() && value.get() === next && lastComplete !== next) {
      lastComplete = next;
      run.expose.emit('completed', { value: next });
    }
    return true;
  };
  def.expose.method('requestValue', request);
  def.expose.method('clear', () => request(''));
  def.expose.method('__focus', (next) => {
    focused.set(!!next, 'reason: OTP editor focus');
    publish();
  });
  def.expose.method('focusInput', () => {
    if (!run || disabled.get()) return false;
    const fn = run.anatomy.partsOf(INPUT_OTP_FAMILY, 'input')[0]?.getExpose('focusSelf');
    if (typeof fn !== 'function') return false;
    fn();
    return true;
  });
  def.lifecycle.onCreated((current) => {
    run = current;
    value.set(
      normalize(
        (current.props.isProvided('value')
          ? current.props.get().value
          : current.props.get().defaultValue) ?? ''
      ),
      'reason: OTP initialize'
    );
    publish();
  });
  def.lifecycle.onMounted((current) => {
    run = current;
    publish();
  });
  def.props.watchAll((current) => {
    run = current;
    value.set(
      normalize(
        current.props.isProvided('value') ? (current.props.get().value ?? '') : value.get()
      ),
      'reason: OTP owner value'
    );
    publish();
  });
  def.lifecycle.onUnmounted(() => {
    focused.set(false, 'reason: OTP detach');
    run = null;
  });
  return (r: RendererHandle<any>) => r.slot();
}
export const asInputOtpRoot = defineAsHook<
  InputOtpRootProps,
  InputOtpRootExposes,
  InputOtpRootAsHookContract
>({ name: 'as-input-otp-root', setup });
export default definePrototype({ name: 'base-input-otp-root', setup });
