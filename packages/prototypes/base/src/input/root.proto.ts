import { defineAsHook, definePrototype, type DefHandle, type RunHandle } from '@proto.ui/core';
import { asFocusable, asTextControl } from '@proto.ui/hooks';
import { declareTextControl } from '@proto.ui/module-text-control';
import type {
  InputChangeDetail,
  InputCompositionDetail,
  InputRootAsHookContract,
  InputRootExposes,
  InputRootProps,
  InputValueChangeDetail,
} from './types';

export type {
  InputChangeDetail,
  InputCompositionDetail,
  InputRootAsHookContract,
  InputRootExposes,
  InputRootProps,
  InputRootStateHandles,
  InputValueChangeDetail,
} from './types';

function setupInputRoot(def: DefHandle<InputRootProps, InputRootExposes>) {
  def.props.define({
    value: { type: 'string', empty: 'fallback' },
    defaultValue: { type: 'string', empty: 'fallback' },
    disabled: { type: 'boolean', empty: 'fallback' },
    readOnly: { type: 'boolean', empty: 'fallback' },
    placeholder: { type: 'string', empty: 'fallback' },
    required: { type: 'boolean', empty: 'fallback' },
    name: { type: 'string', empty: 'fallback' },
    autoComplete: { type: 'string', empty: 'fallback' },
    minLength: { type: 'number', empty: 'fallback' },
    maxLength: { type: 'number', empty: 'fallback' },
    inputMode: {
      type: 'enum',
      empty: 'fallback',
      options: ['none', 'text', 'tel', 'url', 'email', 'numeric', 'decimal', 'search'],
    },
    enterKeyHint: {
      type: 'enum',
      empty: 'fallback',
      options: ['enter', 'done', 'go', 'next', 'previous', 'search', 'send'],
    },
    ariaLabel: { type: 'string', empty: 'fallback' },
    labelledBy: { type: 'string', empty: 'fallback' },
    describedBy: { type: 'string', empty: 'fallback' },
  });
  def.props.setDefaults({
    defaultValue: '',
    disabled: false,
    readOnly: false,
    placeholder: '',
    required: false,
    name: '',
    autoComplete: '',
    minLength: -1,
    maxLength: -1,
    ariaLabel: '',
    labelledBy: '',
    describedBy: '',
  });

  const control = asTextControl<InputRootProps, 'single'>();
  const focusable = asFocusable<InputRootProps>();
  focusable.configure({ disabled: false });
  const value = def.state.string('value', '');
  const disabled = def.state.bool('disabled', false);
  const readOnly = def.state.bool('readOnly', false);
  const composing = def.state.bool('composing', false);
  const ariaLabel = def.state.string('inputAriaLabel', '');
  const labelledBy = def.state.string('inputLabelledBy', '');
  const describedBy = def.state.string('inputDescribedBy', '');
  const focused = focusable.focused;
  const focusVisible = focusable.focusVisible;

  def.expose.state('value', value);
  def.expose.state('disabled', disabled);
  def.expose.state('readOnly', readOnly);
  def.expose.state('focused', focused);
  def.expose.state('focusVisible', focusVisible);
  def.expose.state('composing', composing);
  def.expose.method('focusSelf', (options) => {
    if (!disabled.get()) focusable.focusSelf(options);
  });
  def.expose.method('blurSelf', () => focusable.blur());
  def.expose.event('valueChange', { payload: 'json' });
  def.expose.event('change', { payload: 'json' });
  def.expose.event('compositionStart', { payload: 'json' });
  def.expose.event('compositionUpdate', { payload: 'json' });
  def.expose.event('compositionEnd', { payload: 'json' });

  def.a11y.role('textbox');
  def.a11y.name(ariaLabel);
  def.a11y.state('disabled', disabled);
  def.a11y.state('readOnly', readOnly);
  def.a11y.relation('labelledBy', { target: labelledBy });
  def.a11y.relation('describedBy', { target: describedBy });

  const sync = (props: Readonly<InputRootProps>) => {
    const controlled = typeof props.value === 'string';
    const nextDisabled = props.disabled ?? false;
    disabled.set(nextDisabled, 'reason: input sync disabled');
    readOnly.set(props.readOnly ?? false, 'reason: input sync readonly');
    ariaLabel.set(props.ariaLabel ?? '', 'reason: input sync aria label');
    labelledBy.set(props.labelledBy ?? '', 'reason: input sync labelledby');
    describedBy.set(props.describedBy ?? '', 'reason: input sync describedby');
    focusable.setDisabled(nextDisabled);
    control.sync({
      valueMode: controlled ? 'controlled' : 'uncontrolled',
      value: controlled ? props.value : undefined,
      defaultValue: props.defaultValue ?? '',
      disabled: nextDisabled,
      readOnly: props.readOnly ?? false,
      placeholder: props.placeholder ?? '',
      required: props.required ?? false,
      name: props.name ?? '',
      autoComplete: props.autoComplete ?? '',
      minLength: props.minLength ?? -1,
      maxLength: props.maxLength ?? -1,
      inputMode: props.inputMode,
      enterKeyHint: props.enterKeyHint,
    });
    value.set(control.snapshot()?.value ?? '', 'reason: input sync value');
  };
  def.lifecycle.onCreated((run) => sync(run.props.get()));
  def.props.watch(
    [
      'value',
      'defaultValue',
      'disabled',
      'readOnly',
      'placeholder',
      'required',
      'name',
      'autoComplete',
      'minLength',
      'maxLength',
      'inputMode',
      'enterKeyHint',
      'ariaLabel',
      'labelledBy',
      'describedBy',
    ],
    (_run, next) => sync(next)
  );

  control.on('input', (run, event) => {
    value.set(control.snapshot()?.value ?? event.value, 'reason: input value');
    composing.set(event.composing, 'reason: input composing');
    const detail: InputValueChangeDetail = Object.freeze({
      value: event.value,
      composing: event.composing,
      data: event.data,
      inputType: event.inputType,
    });
    run.expose.emit('valueChange', detail);
  });
  control.on('change', (run, event) => {
    value.set(control.snapshot()?.value ?? event.value, 'reason: input change value');
    run.expose.emit('change', Object.freeze({ value: event.value }));
  });
  const emitComposition = (
    run: RunHandle<InputRootProps>,
    eventName: 'compositionStart' | 'compositionUpdate' | 'compositionEnd',
    event: { value: string; data: string | null }
  ) => {
    const detail: InputCompositionDetail = Object.freeze({ value: event.value, data: event.data });
    run.expose.emit(eventName, detail);
  };
  control.on('compositionstart', (run, event) => {
    composing.set(true, 'reason: input composition start');
    emitComposition(run, 'compositionStart', event);
  });
  control.on('compositionupdate', (run, event) => emitComposition(run, 'compositionUpdate', event));
  control.on('compositionend', (run, event) => {
    composing.set(false, 'reason: input composition end');
    value.set(control.snapshot()?.value ?? event.value, 'reason: input composition end value');
    emitComposition(run, 'compositionEnd', event);
  });
  return () => null;
}

export const asInputRoot = defineAsHook<InputRootProps, InputRootExposes, InputRootAsHookContract>({
  name: 'as-input-root',
  modules: [declareTextControl({ content: 'plain-text', lineMode: 'single', engine: 'host' })],
  setup: setupInputRoot,
});

const inputRoot = definePrototype({
  name: 'base-input-root',
  modules: asInputRoot.modules,
  setup: setupInputRoot,
});
export default inputRoot;
