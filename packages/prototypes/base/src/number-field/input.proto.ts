import type { NumberFieldInputExposes } from './types';
import { FIELD_LABEL_PAIR } from '../field/shared';
import { asFieldControl } from '../field/control-binding.proto';
import type { ObservedStateHandle, State } from '@proto.ui/core';
import { defineAsHook, definePrototype, type DefHandle, type RunHandle } from '@proto.ui/core';
import { asAccessible, asFocusable, asTextControl, asControlLabel } from '@proto.ui/hooks';
import { declareTextControl } from '@proto.ui/module-text-control';
import { NUMBER_FIELD_CONTEXT, NUMBER_FIELD_FAMILY, numberFieldMethod } from './shared';
import type { NumberFieldPartProps } from './types';
export function setupNumberFieldInput(def: DefHandle<NumberFieldPartProps>, field = false) {
  const binding = field ? asFieldControl() : null;
  def.anatomy.claim(NUMBER_FIELD_FAMILY, { role: 'input' });
  const control = asTextControl<NumberFieldPartProps, 'single'>(),
    focus = asFocusable<NumberFieldPartProps>();
  focus.configure({ disabled: false });
  const value = def.state.numberDiscrete('value', 0),
    empty = def.state.bool('empty', false),
    valueNow = def.state.string('valueNow', '0'),
    valueText = def.state.string('valueText', '0'),
    min = def.state.string('min', '0'),
    max = def.state.string('max', '100'),
    disabled = def.state.bool('disabled', false),
    readOnly = def.state.bool('readOnly', false),
    required = def.state.bool('required', false),
    label = def.state.string('label', '');
  for (const [key, s] of Object.entries({
    value,
    empty,
    disabled,
    readOnly,
    required,
    focused: focus.focused,
    focusVisible: focus.focusVisible,
  }))
    def.expose.state(key, s);
  def.expose.method('getValue', () => (empty.get() ? null : value.get()));
  def.expose.method('focusSelf', () => {
    if (!disabled.get()) focus.focusSelf();
  });
  if (binding)
    asControlLabel().target((_run, request) => {
      if (!disabled.get() && request.isCurrent())
        focus.focusSelf({ reason: request.source === 'pointer' ? 'pointer' : 'programmatic' });
    }, FIELD_LABEL_PAIR);
  else
    asControlLabel().target((_run, request) => {
      if (!disabled.get() && request.isCurrent())
        focus.focusSelf({ reason: request.source === 'pointer' ? 'pointer' : 'programmatic' });
    });
  const a = asAccessible();
  a.role('spinbutton');
  a.name(label);
  a.state('valueNow', valueNow);
  a.state('valueText', valueText);
  a.state('valueMin', min);
  a.state('valueMax', max);
  a.state('disabled', disabled);
  a.state('readOnly', readOnly);
  if (!field) a.state('required', required);
  if (!field)
    a.relation('labelledBy', {
      target: { kind: 'part', family: NUMBER_FIELD_FAMILY, role: 'label', key: 'label' },
    });
  let editRevision = 0;
  let compositionActive = false;
  let retiredComposition = false;
  const sync = (run: RunHandle<NumberFieldPartProps>) => {
    const c = run.context.read(NUMBER_FIELD_CONTEXT);
    binding?.setPolicy({
      disabled: c.controlDisabled,
      readOnly: c.controlReadOnly,
      required: c.controlRequired,
    });
    if (c.value !== null) value.set(c.value, 'reason: number input value');
    empty.set(c.value === null, 'reason: number input empty');
    valueNow.set(c.value === null ? '' : String(c.value), 'reason: number input range value');
    valueText.set(c.formatted, 'reason: number input formatted value');
    min.set(c.min === null ? '' : String(c.min), 'reason: number input bound');
    max.set(c.max === null ? '' : String(c.max), 'reason: number input bound');
    disabled.set(c.disabled, 'reason: number input policy');
    readOnly.set(c.readOnly, 'reason: number input policy');
    required.set(
      binding?.state.fieldRequired.get() ?? c.required,
      'reason: number input requirement'
    );
    label.set(c.label, 'reason: number input label');
    focus.setDisabled(c.disabled);
    binding?.report({
      value: c.value,
      focused: focus.focused.get(),
      composing: c.composing,
      reason: 'sync',
    });
    control.sync({
      valueMode: 'controlled',
      value: c.draft,
      disabled: c.disabled,
      readOnly: c.readOnly,
      inputMode: 'decimal',
      name: c.name,
      required: required.get(),
    });
    if (editRevision !== c.editRevision) {
      editRevision = c.editRevision;
      retiredComposition ||= compositionActive;
      compositionActive = false;
      control.resetValue();
    }
  };
  let currentRun: RunHandle<NumberFieldPartProps> | null = null;
  let viewEpoch = 0;
  def.lifecycle.onMounted((run) => {
    viewEpoch++;
    currentRun = run;
  });
  def.lifecycle.onUnmounted(() => {
    viewEpoch++;
    currentRun = null;
    compositionActive = false;
    retiredComposition = false;
  });
  def.expose.method('resetValue', () => {
    const run = currentRun,
      epoch = viewEpoch;
    if (!run) return false;
    control.resetValue();
    if (currentRun !== run || viewEpoch !== epoch) return false;
    return numberFieldMethod(run, 'resetValue') === true;
  });
  def.expose.method('__fieldInput', () => {
    if (currentRun)
      binding?.report({
        value: currentRun.context.read(NUMBER_FIELD_CONTEXT).value,
        focused: focus.focused.get(),
        composing: control.snapshot()?.composing ?? false,
        reason: 'change',
      });
  });
  def.expose.method(
    '__implicitSubmitEligible',
    () => focus.focused.get() && !control.snapshot()?.composing
  );
  def.context.subscribe(NUMBER_FIELD_CONTEXT, sync);
  def.lifecycle.onCreated(sync);
  control.on('compositionstart', (run, e) => {
    compositionActive = true;
    retiredComposition = false;
    numberFieldMethod(run, 'requestInput', e.value, true);
    binding?.report({
      value: run.context.read(NUMBER_FIELD_CONTEXT).value,
      focused: focus.focused.get(),
      composing: true,
      reason: 'sync',
    });
  });
  control.on('input', (run, e) => {
    if (retiredComposition && (e.composing || e.inputType?.toLowerCase().includes('composition'))) {
      control.resetValue();
      return;
    }
    retiredComposition = false;
    numberFieldMethod(run, 'requestInput', e.value, e.composing);
    binding?.report({
      value: run.context.read(NUMBER_FIELD_CONTEXT).value,
      focused: focus.focused.get(),
      composing: e.composing,
      reason: 'input',
    });
  });
  control.on('compositionend', (run, e) => {
    if (!compositionActive) {
      control.resetValue();
      return;
    }
    compositionActive = false;
    numberFieldMethod(run, 'requestInput', e.value, false);
    binding?.report({
      value: run.context.read(NUMBER_FIELD_CONTEXT).value,
      focused: focus.focused.get(),
      composing: false,
      reason: 'compositionend',
    });
  });
  focus.focused.watch((run, e) => {
    if (e.type === 'next') {
      if (!e.next) numberFieldMethod(run, 'commitValue');
      binding?.report({
        value: run.context.read(NUMBER_FIELD_CONTEXT).value,
        focused: e.next,
        composing: control.snapshot()?.composing ?? false,
        reason: e.next ? 'sync' : 'blur',
      });
    }
  });
  def.event.onGlobal('key.down', (run, e) => {
    if (
      !focus.focused.get() ||
      control.snapshot()?.composing ||
      disabled.get() ||
      readOnly.get() ||
      e.ctrlKey ||
      e.altKey ||
      e.metaKey
    )
      return;
    const c = run.context.read(NUMBER_FIELD_CONTEXT);
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.control.requestDefaultActionPrevention({
        reason: 'number-field.step',
        source: 'base-number-field-input',
      });
      numberFieldMethod(run, 'stepBy', (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1));
    } else if (e.key === 'Home' || e.key === 'End') {
      const bound = e.key === 'Home' ? c.min : c.max;
      if (bound === null) return;
      e.control.requestDefaultActionPrevention({
        reason: 'number-field.bound',
        source: 'base-number-field-input',
      });
      numberFieldMethod(run, 'requestValue', bound);
      numberFieldMethod(run, 'commitValue');
    } else if (e.key === 'Enter') numberFieldMethod(run, 'commitValue');
  });
  return () => null;
}
export const asNumberFieldInput = defineAsHook<
  NumberFieldPartProps,
  NumberFieldInputExposes,
  {
    state: {
      disabled: State<boolean>;
      focusVisible: ObservedStateHandle<boolean, NumberFieldPartProps>;
      value: State<number>;
      empty: State<boolean>;
      readOnly: State<boolean>;
      required: State<boolean>;
      focused: ObservedStateHandle<boolean, NumberFieldPartProps>;
    };
  }
>({
  name: 'as-number-field-input',
  modules: [declareTextControl({ content: 'plain-text', lineMode: 'single', engine: 'host' })],
  setup: setupNumberFieldInput,
});
export default definePrototype<NumberFieldPartProps, NumberFieldInputExposes>({
  name: 'base-number-field-input',
  modules: asNumberFieldInput.modules,
  setup: setupNumberFieldInput,
});
