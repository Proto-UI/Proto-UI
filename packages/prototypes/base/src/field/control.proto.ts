import type {
  FieldControlChangeDetail,
  FieldControlCompositionDetail,
  FieldControlValueChangeDetail,
} from './types';
import { defineAsHook, definePrototype, type DefHandle, type RunHandle } from '@proto.ui/core';
import { asAccessible, asFocusable, asTextControl, asControlLabel } from '@proto.ui/hooks';
import { declareTextControl } from '@proto.ui/module-text-control';
import { asFieldControl } from './control-binding.proto';
import { FIELD_CONTEXT, FIELD_LABEL_PAIR } from './shared';
import { createControlledEditReport } from './controlled-edit-report';
import type { FieldControlAsHookContract, FieldControlExposes, FieldControlProps } from './types';

function setupFieldControl(def: DefHandle<FieldControlProps, FieldControlExposes>) {
  const binding = asFieldControl();
  const accessible = asAccessible();
  def.props.define({
    value: { type: 'string', empty: 'fallback' },
    defaultValue: { type: 'string', empty: 'fallback' },
    disabled: { type: 'boolean', empty: 'fallback' },
    readOnly: { type: 'boolean', empty: 'fallback' },
    placeholder: { type: 'string', empty: 'fallback' },
    required: { type: 'boolean', empty: 'fallback' },
    name: { type: 'string', empty: 'fallback' },
    autoComplete: { type: 'string', empty: 'fallback' },
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
  });
  def.props.setDefaults({
    defaultValue: '',
    disabled: false,
    readOnly: false,
    placeholder: '',
    required: false,
    name: '',
    autoComplete: '',
    ariaLabel: '',
  });

  const control = asTextControl<FieldControlProps, 'single'>();
  const focusable = asFocusable<FieldControlProps>();
  focusable.configure({ disabled: false });
  const value = def.state.string('value', '');
  const disabled = def.state.bool('disabled', false);
  const readOnly = def.state.bool('readOnly', false);
  const composing = def.state.bool('composing', false);
  const ariaLabel = def.state.string('inputAriaLabel', '');
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
  asControlLabel().target((_, request) => {
    if (!disabled.get() && request.isCurrent())
      focusable.focusSelf({ reason: request.source === 'pointer' ? 'pointer' : 'programmatic' });
  }, FIELD_LABEL_PAIR);
  def.expose.event('valueChange', { payload: 'json' });
  def.expose.event('change', { payload: 'json' });
  def.expose.event('compositionStart', { payload: 'json' });
  def.expose.event('compositionUpdate', { payload: 'json' });
  def.expose.event('compositionEnd', { payload: 'json' });

  accessible.role('textbox');
  accessible.name(ariaLabel);
  accessible.state('disabled', disabled);
  accessible.state('readOnly', readOnly);
  // Field owns exact anatomy relationships. External ID strings are not a fallback escape hatch.

  let initialValue = '',
    resetRun: RunHandle<FieldControlProps> | null = null;
  let viewEpoch = 0;
  const reportEdit = (reason: 'input' | 'change' | 'compositionend' | 'sync') => {
    if (!resetRun) return;
    binding.report({
      value: control.snapshot()?.value ?? value.get(),
      focused: focused.get(),
      composing: composing.get(),
      reason,
    });
  };
  const controlledReports = createControlledEditReport(reportEdit);
  const notifyEdit = (
    run: RunHandle<FieldControlProps>,
    reason: 'input' | 'change' | 'compositionend'
  ) => {
    if (typeof run.props.get().value === 'string') {
      const revision = controlledReports.revision();
      reportEdit('sync');
      if (resetRun === run && controlledReports.revision() === revision)
        controlledReports.schedule(reason);
    } else reportEdit(reason);
  };
  def.expose.method(
    '__implicitSubmitEligible',
    () => focused.get() && !composing.get() && !control.snapshot()?.composing
  );
  def.expose.method('resetValue', () => {
    if (!resetRun) return false;
    controlledReports.cancel();
    const changed = control.resetValue(initialValue);
    if (!changed && typeof resetRun.props.get().value === 'string')
      resetRun.expose.emit('valueChange', {
        value: initialValue,
        composing: false,
        data: null,
        inputType: null,
      });
    value.set(control.snapshot()?.value ?? value.get(), 'reason: field reset canonical value');
    composing.set(false, 'reason: field reset composition');
    binding.report({
      value: value.get(),
      focused: focused.get(),
      composing: false,
      reason: 'sync',
    });
    return changed;
  });
  def.lifecycle.onMounted((run) => {
    resetRun = run;
  });
  def.lifecycle.onUnmounted(() => {
    controlledReports.cancel();
    viewEpoch++;
    resetRun = null;
    composing.set(false, 'reason: field control view composition retired');
  });
  def.lifecycle.onBeforeDispose(() => {
    controlledReports.cancel();
    viewEpoch++;
    resetRun = null;
  });
  let minLength = -1,
    maxLength = -1;
  const sync = (props: Readonly<FieldControlProps>) => {
    const controlled = typeof props.value === 'string';
    const nextDisabled = binding.state.fieldDisabled.get();
    if (disabled.get() !== nextDisabled || readOnly.get() !== binding.state.fieldReadOnly.get())
      controlledReports.cancel();
    disabled.set(nextDisabled, 'reason: field control sync disabled');
    readOnly.set(binding.state.fieldReadOnly.get(), 'reason: field control sync readonly');
    ariaLabel.set(props.ariaLabel ?? '', 'reason: field control sync aria label');
    focusable.setDisabled(nextDisabled);
    control.sync({
      valueMode: controlled ? 'controlled' : 'uncontrolled',
      value: controlled ? props.value : undefined,
      defaultValue: props.defaultValue ?? '',
      disabled: nextDisabled,
      readOnly: binding.state.fieldReadOnly.get(),
      placeholder: props.placeholder ?? '',
      required: binding.state.fieldRequired.get(),
      name: props.name ?? '',
      autoComplete: props.autoComplete ?? '',
      minLength,
      maxLength,
      inputMode: props.inputMode,
      enterKeyHint: props.enterKeyHint,
    });
    value.set(control.snapshot()?.value ?? '', 'reason: field control sync value');
    binding.report({
      value: value.get(),
      focused: focused.get(),
      composing: composing.get(),
      reason: 'sync',
    });
  };
  def.context.subscribe(FIELD_CONTEXT, (run, ctx) => {
    minLength = ctx.minLength;
    maxLength = ctx.maxLength;
    sync(run.props.get());
  });
  def.expose.state('required', binding.state.fieldRequired);
  for (const state of [
    binding.state.fieldDisabled,
    binding.state.fieldReadOnly,
    binding.state.fieldRequired,
  ])
    state.watch((run, event) => {
      if (event.type === 'next') sync(run.props.get());
    });
  focused.watch((run, event) => {
    if (event.type === 'next')
      binding.report({
        value: value.get(),
        focused: focused.get(),
        composing: composing.get(),
        reason: focused.get() ? 'sync' : 'blur',
      });
  });
  def.lifecycle.onCreated((run) => {
    const ctx = run.context.read(FIELD_CONTEXT);
    minLength = ctx.minLength;
    maxLength = ctx.maxLength;
    sync(run.props.get());
    initialValue = value.get();
  });
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
      'inputMode',
      'enterKeyHint',
      'ariaLabel',
    ],
    (_run, next) => sync(next)
  );

  control.on('input', (run, event) => {
    const epoch = viewEpoch;
    value.set(control.snapshot()?.value ?? event.value, 'reason: field control value');
    if (resetRun !== run || viewEpoch !== epoch) return;
    composing.set(event.composing, 'reason: field control composing');
    if (resetRun !== run || viewEpoch !== epoch) return;
    const detail: FieldControlValueChangeDetail = Object.freeze({
      value: event.value,
      composing: event.composing,
      data: event.data,
      inputType: event.inputType,
    });
    run.expose.emit('valueChange', detail);
    if (resetRun !== run || viewEpoch !== epoch) return;
    // Re-read the module after a synchronous controlled-owner response.
    value.set(control.snapshot()?.value ?? value.get(), 'reason: field canonical owner value');
    if (resetRun !== run || viewEpoch !== epoch) return;
    notifyEdit(run, 'input');
  });
  control.on('change', (run, event) => {
    const epoch = viewEpoch;
    value.set(control.snapshot()?.value ?? event.value, 'reason: field control change value');
    if (resetRun !== run || viewEpoch !== epoch) return;
    run.expose.emit('change', Object.freeze({ value: event.value }));
    if (resetRun !== run || viewEpoch !== epoch) return;
    // A change-only commit is canonical input too. Re-read after the controlled owner's callback.
    value.set(control.snapshot()?.value ?? value.get(), 'reason: field change owner value');
    if (resetRun !== run || viewEpoch !== epoch) return;
    notifyEdit(run, 'change');
  });
  const emitComposition = (
    run: RunHandle<FieldControlProps>,
    eventName: 'compositionStart' | 'compositionUpdate' | 'compositionEnd',
    event: { value: string; data: string | null }
  ) => {
    const detail: FieldControlCompositionDetail = Object.freeze({
      value: event.value,
      data: event.data,
    });
    run.expose.emit(eventName, detail);
  };
  control.on('compositionstart', (run, event) => {
    controlledReports.cancel();
    const epoch = viewEpoch;
    composing.set(true, 'reason: field control composition start');
    if (resetRun !== run || viewEpoch !== epoch) return;
    binding.report({ value: value.get(), composing: true, reason: 'sync' });
    if (resetRun !== run || viewEpoch !== epoch) return;
    emitComposition(run, 'compositionStart', event);
  });
  control.on('compositionupdate', (run, event) => emitComposition(run, 'compositionUpdate', event));
  control.on('compositionend', (run, event) => {
    const epoch = viewEpoch;
    composing.set(false, 'reason: field control composition end');
    if (resetRun !== run || viewEpoch !== epoch) return;
    value.set(
      control.snapshot()?.value ?? event.value,
      'reason: field control composition end value'
    );
    if (resetRun !== run || viewEpoch !== epoch) return;
    emitComposition(run, 'compositionEnd', event);
    if (resetRun !== run || viewEpoch !== epoch) return;
    notifyEdit(run, 'compositionend');
  });
  return () => null;
}

export const asFieldTextControl = defineAsHook<
  FieldControlProps,
  FieldControlExposes,
  FieldControlAsHookContract
>({
  name: 'as-field-text-control',
  modules: [declareTextControl({ content: 'plain-text', lineMode: 'single', engine: 'host' })],
  setup: setupFieldControl,
});

const fieldControl = definePrototype({
  name: 'base-field-control',
  modules: asFieldTextControl.modules,
  setup: setupFieldControl,
});
export default fieldControl;
