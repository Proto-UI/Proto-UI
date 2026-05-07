import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { asButton } from '../button';
import { RADIO_GROUP_CONTEXT, RADIO_GROUP_FAMILY } from './shared';
import type { RadioItemAsHookContract, RadioItemExposes, RadioItemProps } from './types';

function setupRadioItem(def: DefHandle<RadioItemProps, RadioItemExposes>): void {
  def.anatomy.claim(RADIO_GROUP_FAMILY, { role: 'item' });
  asButton();

  def.props.define({
    value: { type: 'string', empty: 'fallback' },
    disabled: { type: 'boolean', empty: 'fallback' },
  });
  def.props.setDefaults({
    value: '',
    disabled: false,
  });

  const checked = def.state.fromAccessibility('checked');
  def.expose.state('checked', checked);

  let currentItemValue = '';

  const syncChecked = (groupValue: string) => {
    const isChecked = !!currentItemValue && groupValue === currentItemValue;
    checked.set(isChecked, 'reason: radio item sync => checked from group');
  };

  def.context.subscribe(RADIO_GROUP_CONTEXT, (_run, next) => {
    const groupValue = next.value ?? '';
    syncChecked(groupValue);
  });

  def.lifecycle.onCreated((run) => {
    currentItemValue = run.props.get().value ?? '';
    syncChecked(run.context.read(RADIO_GROUP_CONTEXT).value ?? '');
  });

  def.props.watch(['value'], (run, next) => {
    currentItemValue = next.value ?? '';
    syncChecked(run.context.read(RADIO_GROUP_CONTEXT).value ?? '');
  });

  def.event.on('press.commit', (run) => {
    const itemValue = run.props.get().value;
    if (!itemValue) return;
    const ownDisabled = !!run.props.get().disabled;
    const ctx = run.context.read(RADIO_GROUP_CONTEXT);
    if (ownDisabled || ctx.disabled) return;
    if (ctx.controlled) {
      run.context.update(RADIO_GROUP_CONTEXT, (prev) => {
        if (prev.requestedValue === itemValue) return prev;
        return { ...prev, requestedValue: itemValue };
      });
      return;
    }

    run.context.update(RADIO_GROUP_CONTEXT, (prev) => {
      if (prev.value === itemValue) return prev;
      return { ...prev, value: itemValue };
    });
  });
}

export const asRadioItem = defineAsHook<RadioItemProps, RadioItemExposes, RadioItemAsHookContract>({
  name: 'as-radio-item',
  mode: 'once',
  setup: setupRadioItem,
});

const radioItem = definePrototype({
  name: 'base-radio-item',
  setup: setupRadioItem,
});

export default radioItem;
