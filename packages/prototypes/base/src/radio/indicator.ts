import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { asToggle } from '../toggle';
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

  asToggle();

  const checked = def.state.bool('checked', false);
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
  });

  def.event.on('click', (run) => {
    const itemValue = run.props.get().value;
    if (!itemValue) return;
    const groupCtx = run.context.get(RADIO_GROUP_CONTEXT);
    if (groupCtx && typeof groupCtx.selectItem === 'function') {
      groupCtx.selectItem(itemValue);
    }
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
