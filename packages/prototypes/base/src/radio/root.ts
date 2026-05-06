import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { RADIO_GROUP_CONTEXT, RADIO_GROUP_FAMILY } from './shared';
import type {
  RadioGroupRootAsHookContract,
  RadioGroupRootExposes,
  RadioGroupRootProps,
} from './types';

function setupRadioGroupRoot(
  def: DefHandle<RadioGroupRootProps, RadioGroupRootExposes>
): void {
  def.anatomy.claim(RADIO_GROUP_FAMILY, { role: 'root' });

  def.props.define({
    value: { type: 'string', empty: 'fallback' },
    defaultValue: { type: 'string', empty: 'fallback' },
    disabled: { type: 'boolean', empty: 'fallback' },
  });
  def.props.setDefaults({
    defaultValue: '',
    disabled: false,
  });

  def.expose.event('valueChange', { payload: 'json' });

  const value = def.state.string('value', '');
  const disabled = def.state.bool('disabled', false);
  def.expose.state('value', value);
  def.expose.state('disabled', disabled);

  let controlled = false;
  let emitValueChange: ((v: string) => void) | null = null;

  const selectItem = (itemValue: string) => {
    if (disabled.get()) return;
    const prev = value.get();
    if (itemValue === prev) return;
    value.set(itemValue, 'reason: selectItem');
    pushContext();
    if (!controlled) {
      emitValueChange?.(itemValue);
    }
  };

  const updateContext = def.context.provide(RADIO_GROUP_CONTEXT, {
    value: '',
    disabled: false,
    controlled: false,
    selectItem,
  });

  const pushContext = () => {
    updateContext({
      value: value.get(),
      disabled: disabled.get(),
      controlled,
      selectItem,
    });
  };

  def.lifecycle.onCreated((run) => {
    emitValueChange = (v: string) => run.event.emit('valueChange', { value: v });
    controlled = run.props.isProvided('value');
    disabled.set(!!run.props.get().disabled, 'reason: lifecycle.onCreated => disabled');
    const initialValue = controlled
      ? (run.props.get().value ?? '')
      : (run.props.get().defaultValue ?? '');
    value.set(initialValue, 'reason: lifecycle.onCreated => initialize value');
    pushContext();
  });

  def.props.watch(['value'], (run, next) => {
    controlled = run.props.isProvided('value');
    if (controlled) {
      const nextValue = next.value ?? '';
      const prev = value.get();
      value.set(nextValue, 'reason: props.watch(value) => controlled sync');
      if (nextValue !== prev) {
        run.event.emit('valueChange', { value: nextValue });
      }
    }
    pushContext();
  });

  def.props.watch(['disabled'], (_run, next) => {
    disabled.set(!!next.disabled, 'reason: props.watch(disabled)');
    pushContext();
  });
}

export const asRadioGroupRoot = defineAsHook<
  RadioGroupRootProps,
  RadioGroupRootExposes,
  RadioGroupRootAsHookContract
>({
  name: 'as-radio-group-root',
  mode: 'once',
  setup: setupRadioGroupRoot,
});

const radioGroupRoot = definePrototype({
  name: 'base-radio-group-root',
  setup: setupRadioGroupRoot,
});

export default radioGroupRoot;
