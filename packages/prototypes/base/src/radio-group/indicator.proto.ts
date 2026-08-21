import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import {
  RADIO_GROUP_FAMILY,
  RADIO_GROUP_ITEM_CONTEXT,
  type RadioGroupItemContextValue,
} from './shared';
import type {
  RadioGroupIndicatorAsHookContract,
  RadioGroupIndicatorExposes,
  RadioGroupIndicatorProps,
} from './types';

function setupRadioGroupIndicator(
  def: DefHandle<RadioGroupIndicatorProps, RadioGroupIndicatorExposes>
): void {
  def.anatomy.claim(RADIO_GROUP_FAMILY, { role: 'indicator' });
  const checked = def.state.bool('checked', false);
  const disabled = def.state.bool('disabled', false);

  const sync = (next: RadioGroupItemContextValue): void => {
    checked.set(next.checked, 'reason: radio indicator checked sync');
    disabled.set(next.disabled, 'reason: radio indicator disabled sync');
  };

  def.expose.state('checked', checked);
  def.expose.state('disabled', disabled);
  def.expose.method('isChecked', () => checked.get());

  def.context.subscribe(RADIO_GROUP_ITEM_CONTEXT, (_run, next) => sync(next));
  def.lifecycle.onMounted((run) => sync(run.context.read(RADIO_GROUP_ITEM_CONTEXT)));
  def.lifecycle.onUpdated((run) => sync(run.context.read(RADIO_GROUP_ITEM_CONTEXT)));
}

export const asRadioGroupIndicator = defineAsHook<
  RadioGroupIndicatorProps,
  RadioGroupIndicatorExposes,
  RadioGroupIndicatorAsHookContract
>({ name: 'as-radio-group-indicator', setup: setupRadioGroupIndicator });

const radioGroupIndicator = definePrototype({
  name: 'base-radio-group-indicator',
  setup: setupRadioGroupIndicator,
});

export default radioGroupIndicator;
