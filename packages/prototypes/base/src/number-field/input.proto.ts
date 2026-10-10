import { FIELD_LABEL_PAIR } from '../field/shared';
import { asFieldControl } from '../field/control-binding.proto';
import type { State } from '@proto.ui/core';
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
    min = def.state.numberDiscrete('min', 0),
    max = def.state.numberDiscrete('max', 100),
    disabled = def.state.bool('disabled', false),
    readOnly = def.state.bool('readOnly', false),
    label = def.state.string('label', '');
  for (const [key, s] of Object.entries({
    value,
    disabled,
    readOnly,
    focused: focus.focused,
    focusVisible: focus.focusVisible,
  }))
    def.expose.state(key, s);
  def.expose.method('focusSelf', () => {
    if (!disabled.get()) focus.focusSelf();
  });
  if (binding)
    asControlLabel().target((_run, request) => {
      if (!disabled.get() && request.isCurrent())
        focus.focusSelf({ reason: request.source === 'pointer' ? 'pointer' : 'programmatic' });
    }, FIELD_LABEL_PAIR);
  const a = asAccessible();
  a.role('spinbutton');
  a.name(label);
  a.state('valueNow', value);
  a.state('valueMin', min);
  a.state('valueMax', max);
  a.state('disabled', disabled);
  a.state('readOnly', readOnly);
  if (!field)
    a.relation('labelledBy', {
      target: { kind: 'part', family: NUMBER_FIELD_FAMILY, role: 'label', key: 'label' },
    });
  const sync = (run: RunHandle<NumberFieldPartProps>) => {
    const c = run.context.read(NUMBER_FIELD_CONTEXT);
    binding?.setPolicy({ disabled: c.controlDisabled, readOnly: c.controlReadOnly });
    value.set(c.value, 'reason: number input value');
    min.set(c.min, 'reason: number input bound');
    max.set(c.max, 'reason: number input bound');
    disabled.set(c.disabled, 'reason: number input policy');
    readOnly.set(c.readOnly, 'reason: number input policy');
    label.set(c.label, 'reason: number input label');
    focus.setDisabled(c.disabled);
    binding?.report({
      value: c.value,
      focused: focus.focused.get(),
      composing: control.snapshot()?.composing ?? false,
      reason: 'sync',
    });
    control.sync({
      valueMode: 'controlled',
      value: c.draft,
      disabled: c.disabled,
      readOnly: c.readOnly,
      inputMode: 'decimal',
      name: c.name,
      required: binding?.state.fieldRequired.get() ?? false,
    });
  };
  let currentRun: RunHandle<NumberFieldPartProps> | null = null;
  def.lifecycle.onMounted((run) => {
    currentRun = run;
  });
  def.lifecycle.onUnmounted(() => {
    currentRun = null;
  });
  def.expose.method('resetValue', () => {
    if (!currentRun) return false;
    control.resetValue();
    return numberFieldMethod(currentRun, 'resetValue');
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
  control.on('compositionstart', (run) => {
    binding?.report({
      value: run.context.read(NUMBER_FIELD_CONTEXT).value,
      focused: focus.focused.get(),
      composing: true,
      reason: 'sync',
    });
  });
  control.on('input', (run, e) => {
    numberFieldMethod(run, 'requestInput', e.value, e.composing);
    binding?.report({
      value: run.context.read(NUMBER_FIELD_CONTEXT).value,
      focused: focus.focused.get(),
      composing: e.composing,
      reason: 'input',
    });
  });
  control.on('compositionend', (run, e) => {
    numberFieldMethod(run, 'requestInput', e.value, false);
    binding?.report({
      value: run.context.read(NUMBER_FIELD_CONTEXT).value,
      focused: focus.focused.get(),
      composing: false,
      reason: 'compositionend',
    });
  });
  control.on('change', (run) => numberFieldMethod(run, 'commitValue'));
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
      e.control.requestDefaultActionPrevention({
        reason: 'number-field.bound',
        source: 'base-number-field-input',
      });
      numberFieldMethod(run, 'requestValue', e.key === 'Home' ? c.min : c.max);
      numberFieldMethod(run, 'commitValue');
    } else if (e.key === 'Enter') numberFieldMethod(run, 'commitValue');
  });
  return () => null;
}
export const asNumberFieldInput = defineAsHook<
  NumberFieldPartProps,
  Record<string, unknown>,
  {
    state: {
      disabled: State<boolean>;
      focusVisible: State<boolean>;
      value: State<number>;
      readOnly: State<boolean>;
      focused: State<boolean>;
    };
  }
>({
  name: 'as-number-field-input',
  modules: [declareTextControl({ content: 'plain-text', lineMode: 'single', engine: 'host' })],
  setup: setupNumberFieldInput,
});
export default definePrototype({
  name: 'base-number-field-input',
  modules: asNumberFieldInput.modules,
  setup: setupNumberFieldInput,
});
