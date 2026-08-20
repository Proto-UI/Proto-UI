import { defineAsHook, definePrototype, type DefHandle, type RunHandle } from '@proto.ui/core';
import { asFocusable, asTextControl } from '@proto.ui/hooks';
import { declareTextControl } from '@proto.ui/module-text-control';
import type {
  TextareaCompositionDetail,
  TextareaRootAsHookContract,
  TextareaRootExposes,
  TextareaRootProps,
  TextareaValueChangeDetail,
} from './types';

export type {
  TextareaChangeDetail,
  TextareaCompositionDetail,
  TextareaRootAsHookContract,
  TextareaRootExposes,
  TextareaRootProps,
  TextareaRootStateHandles,
  TextareaValueChangeDetail,
} from './types';

function setupTextareaRoot(def: DefHandle<TextareaRootProps, TextareaRootExposes>) {
  def.props.define({
    value: { type: 'string', empty: 'fallback' },
    defaultValue: { type: 'string', empty: 'fallback' },
    disabled: { type: 'boolean', empty: 'fallback' },
    readOnly: { type: 'boolean', empty: 'fallback' },
    placeholder: { type: 'string', empty: 'fallback' },
    rows: { type: 'number', empty: 'fallback' },
    required: { type: 'boolean', empty: 'fallback' },
    name: { type: 'string', empty: 'fallback' },
    autoComplete: { type: 'string', empty: 'fallback' },
    minLength: { type: 'number', empty: 'fallback' },
    maxLength: { type: 'number', empty: 'fallback' },
    wrap: { type: 'enum', empty: 'fallback', options: ['soft', 'hard'] },
    ariaLabel: { type: 'string', empty: 'fallback' },
    labelledBy: { type: 'string', empty: 'fallback' },
    describedBy: { type: 'string', empty: 'fallback' },
  });
  def.props.setDefaults({
    defaultValue: '',
    disabled: false,
    readOnly: false,
    placeholder: '',
    rows: 2,
    required: false,
    name: '',
    autoComplete: '',
    minLength: -1,
    maxLength: -1,
    wrap: 'soft',
    ariaLabel: '',
    labelledBy: '',
    describedBy: '',
  });

  const control = asTextControl<TextareaRootProps>();
  const focusable = asFocusable<TextareaRootProps>();
  focusable.configure({ disabled: false });

  const value = def.state.string('value', '');
  const disabled = def.state.bool('disabled', false);
  const readOnly = def.state.bool('readOnly', false);
  const composing = def.state.bool('composing', false);
  const ariaLabel = def.state.string('textareaAriaLabel', '');
  const labelledBy = def.state.string('textareaLabelledBy', '');
  const describedBy = def.state.string('textareaDescribedBy', '');
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

  const sync = (props: Readonly<TextareaRootProps>) => {
    const isControlled = typeof props.value === 'string';
    const nextDisabled = props.disabled ?? false;
    disabled.set(nextDisabled, 'reason: textarea sync disabled');
    readOnly.set(props.readOnly ?? false, 'reason: textarea sync readonly');
    ariaLabel.set(props.ariaLabel ?? '', 'reason: textarea sync aria label');
    labelledBy.set(props.labelledBy ?? '', 'reason: textarea sync labelledby');
    describedBy.set(props.describedBy ?? '', 'reason: textarea sync describedby');
    focusable.setDisabled(nextDisabled);
    control.sync({
      valueMode: isControlled ? 'controlled' : 'uncontrolled',
      value: isControlled ? props.value : undefined,
      defaultValue: props.defaultValue ?? '',
      disabled: nextDisabled,
      readOnly: props.readOnly ?? false,
      placeholder: props.placeholder ?? '',
      rows: props.rows ?? 2,
      required: props.required ?? false,
      name: props.name ?? '',
      autoComplete: props.autoComplete ?? '',
      minLength: props.minLength ?? -1,
      maxLength: props.maxLength ?? -1,
      wrap: props.wrap ?? 'soft',
    });
    value.set(control.snapshot()?.value ?? '', 'reason: textarea sync value');
  };

  def.lifecycle.onCreated((run) => sync(run.props.get()));
  def.props.watch(
    [
      'value',
      'defaultValue',
      'disabled',
      'readOnly',
      'placeholder',
      'rows',
      'required',
      'name',
      'autoComplete',
      'minLength',
      'maxLength',
      'wrap',
      'ariaLabel',
      'labelledBy',
      'describedBy',
    ],
    (_run, next) => sync(next)
  );

  control.on('input', (run, event) => {
    value.set(control.snapshot()?.value ?? event.value, 'reason: textarea input value');
    composing.set(event.composing, 'reason: textarea input composing');
    const detail: TextareaValueChangeDetail = Object.freeze({
      value: event.value,
      composing: event.composing,
      data: event.data,
      inputType: event.inputType,
    });
    run.expose.emit('valueChange', detail);
  });
  control.on('change', (run, event) => {
    value.set(control.snapshot()?.value ?? event.value, 'reason: textarea change value');
    run.expose.emit('change', Object.freeze({ value: event.value }));
  });

  const emitComposition = (
    run: RunHandle<TextareaRootProps>,
    eventName: 'compositionStart' | 'compositionUpdate' | 'compositionEnd',
    event: { value: string; data: string | null }
  ) => {
    const detail: TextareaCompositionDetail = Object.freeze({
      value: event.value,
      data: event.data,
    });
    run.expose.emit(eventName, detail);
  };
  control.on('compositionstart', (run, event) => {
    composing.set(true, 'reason: textarea composition start');
    emitComposition(run, 'compositionStart', event);
  });
  control.on('compositionupdate', (run, event) => {
    emitComposition(run, 'compositionUpdate', event);
  });
  control.on('compositionend', (run, event) => {
    composing.set(false, 'reason: textarea composition end');
    value.set(control.snapshot()?.value ?? event.value, 'reason: textarea composition end value');
    emitComposition(run, 'compositionEnd', event);
  });
  return () => null;
}

export const asTextareaRoot = defineAsHook<
  TextareaRootProps,
  TextareaRootExposes,
  TextareaRootAsHookContract
>({
  name: 'as-textarea-root',
  modules: [
    declareTextControl({
      content: 'plain-text',
      lineMode: 'multiline',
      engine: 'host',
    }),
  ],
  setup: setupTextareaRoot,
});

const textareaRoot = definePrototype({
  name: 'base-textarea-root',
  modules: asTextareaRoot.modules,
  setup: setupTextareaRoot,
});

export default textareaRoot;
