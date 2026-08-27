import { defineAsHook, definePrototype, type DefHandle, type RunHandle } from '@proto.ui/core';
import { asCollectionItem, asFocusable, asTrigger } from '@proto.ui/hooks';
import {
  createRadioGroupItemId,
  notifyRadioGroupItemsChanged,
  RADIO_GROUP_CONTEXT,
  RADIO_GROUP_FAMILY,
  RADIO_GROUP_ITEM_CONTEXT,
  requestRadioGroupValue,
  setRadioGroupCurrentItem,
  type RadioGroupContextValue,
} from './shared';
import type {
  RadioGroupItemAsHookContract,
  RadioGroupItemExposes,
  RadioGroupItemProps,
} from './types';

function setupRadioGroupItem(def: DefHandle<RadioGroupItemProps, RadioGroupItemExposes>): void {
  asTrigger();
  const focusable = asFocusable<RadioGroupItemProps>();
  focusable.configure({ disabled: false });
  const collectionItem = asCollectionItem();
  const instanceId = createRadioGroupItemId();
  collectionItem.configure({
    family: RADIO_GROUP_FAMILY,
    role: 'item',
    exposeSnapshotMethodKey: '__collectionSnapshot',
    getMeta: (run) => ({
      instanceId,
      value: run.props.get().value ?? '',
      disabled: !!run.props.get().disabled,
    }),
  });

  def.props.define({
    value: { type: 'string', empty: 'fallback' },
    disabled: { type: 'boolean', empty: 'fallback' },
  });
  def.props.setDefaults({ value: '', disabled: false });

  const checked = def.state.bool('checked', false);
  const disabled = def.state.bool('disabled', false);
  const hovered = def.state.bool('hovered', false);
  const pressed = def.state.bool('pressed', false);
  const focused = focusable.focused;
  const focusVisible = focusable.focusVisible;

  def.expose.state('checked', checked);
  def.expose.state('disabled', disabled);
  def.expose.state('hovered', hovered);
  def.expose.state('focused', focused);
  def.expose.state('focusVisible', focusVisible);
  def.expose.state('pressed', pressed);
  def.expose.event('select', { payload: 'json' });

  def.a11y.role('radio');
  def.a11y.nameFromContent();
  def.a11y.state('checked', checked);
  def.a11y.state('disabled', disabled);
  def.a11y.action('activate', { event: 'select' });

  def.context.provide(RADIO_GROUP_ITEM_CONTEXT, { checked: false, disabled: false });
  let itemContextSnapshot = { checked: false, disabled: false };

  const publishItemContext = (run: RunHandle<RadioGroupItemProps>): void => {
    const next = { checked: checked.get(), disabled: disabled.get() };
    if (
      itemContextSnapshot.checked === next.checked &&
      itemContextSnapshot.disabled === next.disabled
    ) {
      return;
    }
    itemContextSnapshot = next;
    run.context.update(RADIO_GROUP_ITEM_CONTEXT, next);
  };

  const sync = (run: RunHandle<RadioGroupItemProps>, group: RadioGroupContextValue): void => {
    const effectiveDisabled = group.disabled || !!run.props.get().disabled;
    const nextChecked = group.selectedItemId === instanceId;
    const current = !effectiveDisabled && group.currentItemId === instanceId;
    disabled.set(effectiveDisabled, 'reason: radio item effective disabled sync');
    checked.set(nextChecked, 'reason: radio item checked sync');
    focusable.setDisabled(effectiveDisabled);
    focusable.setNavParticipation(current ? 'auto' : 'none');
    focusable.setRovingStatus({ selected: nextChecked, active: current });
    if (effectiveDisabled) {
      hovered.set(false, 'reason: radio item disabled => hovered reset');
      pressed.set(false, 'reason: radio item disabled => pressed reset');
    }
    publishItemContext(run);
  };

  const setCurrent = (run: RunHandle<RadioGroupItemProps>): void => {
    setRadioGroupCurrentItem(run, instanceId);
  };

  const requestSelection = (run: RunHandle<RadioGroupItemProps>): boolean => {
    const ownValue = run.props.get().value ?? '';
    const accepted = requestRadioGroupValue(run, ownValue);
    if (accepted) run.expose.emit('select', { value: ownValue });
    return accepted;
  };

  def.expose.method('focusSelf', (options) => {
    if (disabled.get()) return;
    const run = currentRun;
    if (!run) return;
    setCurrent(run);
    focusable.focusSelf(options);
  });

  let currentRun: RunHandle<RadioGroupItemProps> | null = null;

  def.context.subscribe(RADIO_GROUP_CONTEXT, (run, next) => {
    currentRun = run;
    sync(run, next);
  });

  def.lifecycle.onMounted((run) => {
    currentRun = run;
    sync(run, run.context.read(RADIO_GROUP_CONTEXT));
    notifyRadioGroupItemsChanged(run);
  });

  def.lifecycle.onUpdated((run) => {
    currentRun = run;
    sync(run, run.context.read(RADIO_GROUP_CONTEXT));
  });

  def.lifecycle.onUnmounted(() => {
    currentRun = null;
  });

  def.props.watch(['value', 'disabled'], (run) => {
    sync(run, run.context.read(RADIO_GROUP_CONTEXT));
    notifyRadioGroupItemsChanged(run);
  });

  focused.watch((run, event) => {
    if (event.type !== 'next' || !event.next || disabled.get()) return;
    const group = run.context.read(RADIO_GROUP_CONTEXT);
    if (group.currentItemId === instanceId) return;
    setCurrent(run);
    requestSelection(run);
  });

  def.event.onGlobal('key.down', (_run, event) => {
    if (disabled.get() || !focused.get() || event?.key !== ' ') return;
    event.control.requestDefaultActionPrevention({
      reason: 'radio-item.space-activation',
      source: 'base-radio-group-item',
    });
  });

  def.event.on('press.commit', (run, event) => {
    pressed.set(false, 'reason: radio item press commit => pressed reset');
    if (disabled.get()) return;
    if (event?.key === 'Enter') return;
    setCurrent(run);
    requestSelection(run);
  });

  def.event.on('pointer.enter', () => {
    if (!disabled.get()) hovered.set(true, 'reason: radio item pointer enter');
  });
  def.event.on('pointer.leave', () => {
    hovered.set(false, 'reason: radio item pointer leave');
    pressed.set(false, 'reason: radio item pointer leave => pressed reset');
  });
  def.event.on('pointer.cancel', (run) => {
    hovered.set(false, 'reason: radio item pointer cancel');
    pressed.set(false, 'reason: radio item pointer cancel => pressed reset');
    const group = run.context.read(RADIO_GROUP_CONTEXT);
    setRadioGroupCurrentItem(run, group.selectedItemId);
  });
  def.event.on('pointer.down', (run) => {
    if (disabled.get()) return;
    pressed.set(true, 'reason: radio item pointer down');
    setCurrent(run);
    focusable.focusSelf({ reason: 'pointer' });
  });
  def.event.on('pointer.up', () => {
    pressed.set(false, 'reason: radio item pointer up');
  });
}

export const asRadioGroupItem = defineAsHook<
  RadioGroupItemProps,
  RadioGroupItemExposes,
  RadioGroupItemAsHookContract
>({ name: 'as-radio-group-item', setup: setupRadioGroupItem });

const radioGroupItem = definePrototype({
  name: 'base-radio-group-item',
  setup: setupRadioGroupItem,
});

export default radioGroupItem;
