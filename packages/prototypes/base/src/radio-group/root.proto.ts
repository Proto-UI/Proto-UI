import { defineAsHook, definePrototype, type DefHandle, type RunHandle } from '@proto.ui/core';
import { asCollection, asFocusRoving } from '@proto.ui/hooks';
import {
  getRadioGroupItems,
  RADIO_GROUP_CONTEXT,
  RADIO_GROUP_FAMILY,
  registerRadioGroupCoordinator,
  type RadioGroupContextValue,
  type RadioGroupItemSnapshot,
} from './shared';
import type {
  RadioGroupRootAsHookContract,
  RadioGroupRootExposes,
  RadioGroupRootProps,
} from './types';

function canonicalSelectedItem(
  items: readonly RadioGroupItemSnapshot[],
  value: string
): RadioGroupItemSnapshot | null {
  if (!value) return null;
  return items.find((item) => item.value === value) ?? null;
}

function resolveCurrentItemId(
  items: readonly RadioGroupItemSnapshot[],
  value: string,
  currentItemId: string
): string {
  const current = items.find((item) => item.instanceId === currentItemId && !item.disabled);
  if (current) return current.instanceId;
  const selected = canonicalSelectedItem(items, value);
  if (selected && !selected.disabled) return selected.instanceId;
  return items.find((item) => !item.disabled)?.instanceId ?? '';
}

function sameContext(a: RadioGroupContextValue, b: RadioGroupContextValue): boolean {
  return (
    a.value === b.value &&
    a.controlled === b.controlled &&
    a.disabled === b.disabled &&
    a.selectedItemId === b.selectedItemId &&
    a.currentItemId === b.currentItemId
  );
}

function setupRadioGroupRoot(
  def: DefHandle<RadioGroupRootProps, RadioGroupRootExposes>
): void {
  def.anatomy.claim(RADIO_GROUP_FAMILY, { role: 'root' });

  const collection = asCollection();
  collection.configure({ family: RADIO_GROUP_FAMILY, itemRole: 'item' });
  const focusRoving = asFocusRoving<RadioGroupRootProps>();
  focusRoving.configure({
    navigation: 'arrow',
    orientation: 'both',
    loop: true,
    entry: 'selected',
  });

  def.props.define({
    value: { type: 'string', empty: 'fallback' },
    defaultValue: { type: 'string', empty: 'fallback' },
    disabled: { type: 'boolean', empty: 'fallback' },
    a11yLabel: { type: 'string', empty: 'fallback' },
  });
  def.props.setDefaults({ defaultValue: '', disabled: false, a11yLabel: '' });

  const value = def.state.string('value', '');
  const disabled = def.state.bool('disabled', false);
  const a11yLabel = def.state.string('a11yLabel', '');

  def.expose.state('value', value);
  def.expose.state('disabled', disabled);
  def.expose.event('valueChange', { payload: 'json' });
  def.expose.method('focusFirst', () => focusRoving.focusFirst());
  def.expose.method('focusLast', () => focusRoving.focusLast());
  def.expose.method('focusNext', () => focusRoving.focusNext());
  def.expose.method('focusPrev', () => focusRoving.focusPrev());
  def.expose.method('focusSelected', () => focusRoving.focusSelected());

  def.a11y.role('radiogroup');
  def.a11y.name(a11yLabel);
  def.a11y.state('disabled', disabled);

  const initialContext: RadioGroupContextValue = {
    value: '',
    controlled: false,
    disabled: false,
    selectedItemId: '',
    currentItemId: '',
  };
  def.context.provide(RADIO_GROUP_CONTEXT, initialContext);

  let currentRun: RunHandle<RadioGroupRootProps> | null = null;
  let contextSnapshot = initialContext;

  const publish = (run: RunHandle<RadioGroupRootProps>, preferredCurrentId?: string): void => {
    const items = getRadioGroupItems(run);
    const next: RadioGroupContextValue = {
      value: value.get(),
      controlled: run.props.isProvided('value'),
      disabled: disabled.get(),
      selectedItemId: canonicalSelectedItem(items, value.get())?.instanceId ?? '',
      currentItemId: resolveCurrentItemId(
        items,
        value.get(),
        preferredCurrentId ?? contextSnapshot.currentItemId
      ),
    };
    if (sameContext(contextSnapshot, next)) return;
    contextSnapshot = next;
    run.context.update(RADIO_GROUP_CONTEXT, next);
  };

  const submitValueRequest = (run: RunHandle<RadioGroupRootProps>, nextValue: string): boolean => {
    if (disabled.get() || !nextValue || nextValue === value.get()) return false;
    const matches = getRadioGroupItems(run).filter((item) => item.value === nextValue);
    if (matches.length !== 1 || matches[0]?.disabled) return false;
    const target = matches[0];
    if (!run.props.isProvided('value')) {
      value.set(nextValue, 'reason: radio group accepted uncontrolled value request');
    }
    publish(run, target.instanceId);
    run.expose.emit('valueChange', { value: nextValue });
    return true;
  };

  let requestedCurrentItemId: string | undefined;

  const requestValue = (nextValue: string): boolean => {
    if (!currentRun) return false;
    const preferredCurrentId = requestedCurrentItemId;
    requestedCurrentItemId = undefined;
    publish(currentRun, preferredCurrentId);
    return submitValueRequest(currentRun, nextValue);
  };
  def.expose.method('requestValue', requestValue);

  let unregisterCoordinator: (() => void) | null = null;

  const registerCoordinator = (): void => {
    unregisterCoordinator?.();
    unregisterCoordinator = registerRadioGroupCoordinator(value, {
      setCurrent: (itemId) => {
        requestedCurrentItemId = itemId;
      },
    });
  };

  def.lifecycle.onCreated((run) => {
    currentRun = run;
    registerCoordinator();
    const controlled = run.props.isProvided('value');
    value.set(
      controlled ? (run.props.get().value ?? '') : (run.props.get().defaultValue ?? ''),
      'reason: radio group initialize value'
    );
    disabled.set(!!run.props.get().disabled, 'reason: radio group initialize disabled');
    a11yLabel.set(run.props.get().a11yLabel ?? '', 'reason: radio group initialize label');
    publish(run);
  });

  def.lifecycle.onMounted((run) => {
    currentRun = run;
    publish(run);
  });

  def.lifecycle.onUpdated((run) => {
    currentRun = run;
    publish(run);
  });

  def.lifecycle.onUnmounted(() => {
    currentRun = null;
    unregisterCoordinator?.();
    unregisterCoordinator = null;
  });

  def.anatomy.subscribeParts(RADIO_GROUP_FAMILY, 'item', (run) => publish(run));

  def.context.subscribe(RADIO_GROUP_CONTEXT, (run, next) => {
    currentRun = run;
    contextSnapshot = next;
  });

  def.props.watch(['value', 'disabled', 'a11yLabel'], (run, next) => {
    if (run.props.isProvided('value')) {
      value.set(next.value ?? '', 'reason: radio group controlled value sync');
    }
    disabled.set(!!next.disabled, 'reason: radio group disabled sync');
    a11yLabel.set(next.a11yLabel ?? '', 'reason: radio group label sync');
    publish(run);
  });
}

export const asRadioGroupRoot = defineAsHook<
  RadioGroupRootProps,
  RadioGroupRootExposes,
  RadioGroupRootAsHookContract
>({ name: 'as-radio-group-root', setup: setupRadioGroupRoot });

const radioGroupRoot = definePrototype({
  name: 'base-radio-group-root',
  setup: setupRadioGroupRoot,
});

export default radioGroupRoot;
