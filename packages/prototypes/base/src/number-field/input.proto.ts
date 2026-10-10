import type { State } from '@proto.ui/core';
import { defineAsHook, definePrototype, type DefHandle, type RunHandle } from '@proto.ui/core';
import { asAccessible, asFocusable, asTextControl } from '@proto.ui/hooks';
import { declareTextControl } from '@proto.ui/module-text-control';
import { NUMBER_FIELD_CONTEXT, NUMBER_FIELD_FAMILY, numberFieldMethod } from './shared';
import type { NumberFieldPartProps } from './types';
function setup(def: DefHandle<NumberFieldPartProps>) {
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
  const a = asAccessible();
  a.role('spinbutton');
  a.name(label);
  a.state('valueNow', value);
  a.state('valueMin', min);
  a.state('valueMax', max);
  a.state('disabled', disabled);
  a.state('readOnly', readOnly);
  a.relation('labelledBy', {
    target: { kind: 'part', family: NUMBER_FIELD_FAMILY, role: 'label', key: 'label' },
  });
  const sync = (run: RunHandle<NumberFieldPartProps>) => {
    const c = run.context.read(NUMBER_FIELD_CONTEXT);
    value.set(c.value, 'reason: number input value');
    min.set(c.min, 'reason: number input bound');
    max.set(c.max, 'reason: number input bound');
    disabled.set(c.disabled, 'reason: number input policy');
    readOnly.set(c.readOnly, 'reason: number input policy');
    label.set(c.label, 'reason: number input label');
    focus.setDisabled(c.disabled);
    control.sync({
      valueMode: 'controlled',
      value: c.draft,
      disabled: c.disabled,
      readOnly: c.readOnly,
      inputMode: 'decimal',
      name: c.name,
    });
  };
  def.context.subscribe(NUMBER_FIELD_CONTEXT, sync);
  def.lifecycle.onCreated(sync);
  control.on('input', (run, e) => numberFieldMethod(run, 'requestInput', e.value, e.composing));
  control.on('compositionend', (run, e) => numberFieldMethod(run, 'requestInput', e.value, false));
  control.on('change', (run) => numberFieldMethod(run, 'commitValue'));
  focus.focused.watch((run, e) => {
    if (e.type === 'next' && !e.next) numberFieldMethod(run, 'commitValue');
  });
  def.event.onGlobal('key.down', (run, e) => {
    if (
      !focus.focused.get() ||
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
  setup,
});
export default definePrototype({
  name: 'base-number-field-input',
  modules: asNumberFieldInput.modules,
  setup,
});
