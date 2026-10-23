import { defineAsHook, definePrototype, type DefHandle, type RunHandle } from '@proto.ui/core';
import { asAccessible, asFocusable, asTextControl, asControlLabel } from '@proto.ui/hooks';
import { asOptionalFieldControl } from '../field/control-binding.proto';
import { FIELD_LABEL_PAIR } from '../field/shared';
import type { FieldControlReport } from '../field/types';
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

export type TextareaRootSetupOptions = Readonly<{ fieldBinding?: boolean }>;

/** Definition-time composition only. The ordinary Textarea entry keeps explicit label associations. */
export function setupTextareaRoot(
  def: DefHandle<TextareaRootProps, TextareaRootExposes>,
  options: TextareaRootSetupOptions = {}
) {
  const binding = options.fieldBinding ? asOptionalFieldControl() : null;
  const accessible = asAccessible();
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
  asControlLabel().target(
    (_, request) => {
      if (!disabled.get() && request.isCurrent())
        focusable.focusSelf({ reason: request.source === 'pointer' ? 'pointer' : 'programmatic' });
    },
    options.fieldBinding ? FIELD_LABEL_PAIR : undefined
  );
  def.expose.event('valueChange', { payload: 'json' });
  def.expose.event('change', { payload: 'json' });
  def.expose.event('compositionStart', { payload: 'json' });
  def.expose.event('compositionUpdate', { payload: 'json' });
  def.expose.event('compositionEnd', { payload: 'json' });

  accessible.role('textbox');
  accessible.name(ariaLabel);
  accessible.state('disabled', disabled);
  accessible.state('readOnly', readOnly);
  if (!binding) {
    accessible.relation('labelledBy', { target: labelledBy });
    accessible.relation('describedBy', { target: describedBy });
  }
  // The Field binding owns invalid/busy and part relationships. Do not replace
  // them with the ordinary Textarea's empty external-ID defaults.
  const reportField = (reason: FieldControlReport['reason'] = 'sync') =>
    binding?.report({
      value: control.snapshot()?.value ?? value.get(),
      focused: focused.get(),
      composing: composing.get(),
      reason,
    });
  let currentView: RunHandle<TextareaRootProps> | null = null;
  let viewEpoch = 0;
  def.lifecycle.onMounted((run) => {
    currentView = run;
    reportField();
  });
  def.lifecycle.onUnmounted(() => {
    currentView = null;
    viewEpoch++;
  });
  def.lifecycle.onBeforeDispose(() => {
    currentView = null;
    viewEpoch++;
  });

  const sync = (props: Readonly<TextareaRootProps>, report = true) => {
    const isControlled = typeof props.value === 'string';
    const nextDisabled = binding ? binding.state.fieldDisabled.get() : (props.disabled ?? false);
    const nextReadOnly = binding ? binding.state.fieldReadOnly.get() : (props.readOnly ?? false);
    const nextRequired = binding ? binding.state.fieldRequired.get() : (props.required ?? false);
    disabled.set(nextDisabled, 'reason: textarea sync disabled');
    readOnly.set(nextReadOnly, 'reason: textarea sync readonly');
    ariaLabel.set(props.ariaLabel ?? '', 'reason: textarea sync aria label');
    labelledBy.set(props.labelledBy ?? '', 'reason: textarea sync labelledby');
    describedBy.set(props.describedBy ?? '', 'reason: textarea sync describedby');
    focusable.setDisabled(nextDisabled);
    control.sync({
      valueMode: isControlled ? 'controlled' : 'uncontrolled',
      value: isControlled ? props.value : undefined,
      defaultValue: props.defaultValue ?? '',
      disabled: nextDisabled,
      readOnly: nextReadOnly,
      placeholder: props.placeholder ?? '',
      rows: props.rows ?? 2,
      required: nextRequired,
      name: props.name ?? '',
      autoComplete: props.autoComplete ?? '',
      minLength: props.minLength ?? -1,
      maxLength: props.maxLength ?? -1,
      wrap: props.wrap ?? 'soft',
    });
    value.set(control.snapshot()?.value ?? '', 'reason: textarea sync value');
    if (report) reportField();
  };

  if (binding) {
    for (const state of [
      binding.state.fieldDisabled,
      binding.state.fieldReadOnly,
      binding.state.fieldRequired,
    ]) {
      state.watch((run, event) => {
        if (event.type === 'next') sync(run.props.get(), false);
      });
    }
    focused.watch((_run, event) => {
      if (event.type === 'next') reportField(focused.get() ? 'sync' : 'blur');
    });
    const checkRelations = (run: RunHandle<TextareaRootProps>) => {
      const raw = run.props.getRaw();
      if (raw.labelledBy || raw.describedBy)
        throw new Error(
          '[field-textarea] Field owns label and description relationships; external ID inputs are not admitted.'
        );
    };
    def.lifecycle.onCreated(checkRelations);
    def.props.watchRaw(['labelledBy', 'describedBy'], checkRelations);
  }
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
    const epoch = viewEpoch;
    value.set(control.snapshot()?.value ?? event.value, 'reason: textarea input value');
    composing.set(event.composing, 'reason: textarea input composing');
    const detail: TextareaValueChangeDetail = Object.freeze({
      value: event.value,
      composing: event.composing,
      data: event.data,
      inputType: event.inputType,
    });
    run.expose.emit('valueChange', detail);
    if (binding && currentView === run && epoch === viewEpoch) reportField('input');
  });
  control.on('change', (run, event) => {
    const epoch = viewEpoch;
    value.set(control.snapshot()?.value ?? event.value, 'reason: textarea change value');
    run.expose.emit('change', Object.freeze({ value: event.value }));
    if (binding && currentView === run && epoch === viewEpoch) reportField('change');
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
    const epoch = viewEpoch;
    emitComposition(run, 'compositionStart', event);
    if (binding && currentView === run && epoch === viewEpoch) reportField();
  });
  control.on('compositionupdate', (run, event) => {
    emitComposition(run, 'compositionUpdate', event);
  });
  control.on('compositionend', (run, event) => {
    composing.set(false, 'reason: textarea composition end');
    value.set(control.snapshot()?.value ?? event.value, 'reason: textarea composition end value');
    const epoch = viewEpoch;
    emitComposition(run, 'compositionEnd', event);
    if (binding && currentView === run && epoch === viewEpoch) reportField('compositionend');
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
