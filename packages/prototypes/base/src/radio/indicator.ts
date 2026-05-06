import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { asButton } from '../button';
import { RADIO_GROUP_CONTEXT, RADIO_GROUP_FAMILY } from './shared';
import type {
  RadioItemAsHookContract,
  RadioItemExposes,
  RadioItemProps,
} from './types';

function setupRadioItem(def: DefHandle<RadioItemProps, RadioItemExposes>): void {
  def.anatomy.claim(RADIO_GROUP_FAMILY, { role: 'item' });

  def.props.define({
    value: { type: 'string', empty: 'fallback' },
    disabled: { type: 'boolean', empty: 'fallback' },
  });
  def.props.setDefaults({
    value: '',
    disabled: false,
  });

  asButton();

  const checked = def.state.fromAccessibility('checked');
  def.expose.state('checked', checked);

  let currentItemValue = '';

  def.context.subscribe(RADIO_GROUP_CONTEXT, (_run, next) => {
    const groupValue = next.value ?? '';
    const groupDisabled = next.disabled ?? false;
    const isChecked = groupValue !== '' && groupValue === currentItemValue;
    checked.set(isChecked, 'reason: context.subscribe => sync checked from group');
  });

  def.lifecycle.onCreated((run) => {
    currentItemValue = run.props.get().value ?? '';
    const ctx = run.context.read(RADIO_GROUP_CONTEXT);
    const isChecked = ctx.value !== '' && ctx.value === currentItemValue;
    checked.set(isChecked, 'reason: lifecycle.onCreated => sync initial checked from group');
  });

  def.event.on('press.commit', (run) => {
    const itemValue = run.props.get().value;
    if (!itemValue) return;
    const ctx = run.context.read(RADIO_GROUP_CONTEXT);
    if (ctx && ctx.disabled) return;
    run.context.update(RADIO_GROUP_CONTEXT, (prev) => ({ ...prev, value: itemValue }));
  });
}

export const asRadioItem = defineAsHook<
  RadioItemProps,
  RadioItemExposes,
  RadioItemAsHookContract
>({
  name: 'as-radio-item',
  mode: 'once',
  setup: setupRadioItem,
});

const radioItem = definePrototype({
  name: 'base-radio-item',
  setup: setupRadioItem,
});

export default radioItem;
