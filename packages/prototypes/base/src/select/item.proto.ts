import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { asCollectionItem } from '@proto.ui/hooks';
import { setupSelectCommand } from './command';
import {
  notifySelectItemSnapshotChanged,
  requestSelectOpen,
  requestSelectValue,
  SELECT_CONTEXT,
  SELECT_FAMILY,
  type SelectContextValue,
  type SelectFocusReason,
} from './shared';
import type { SelectItemAsHookContract, SelectItemExposes, SelectItemProps } from './types';

function setupSelectItem(def: DefHandle<SelectItemProps, SelectItemExposes>): void {
  const command = setupSelectCommand(def, 'select item');
  const active = def.state.bool('active', false);
  const selected = def.state.fromAccessibility('selected');
  const collectionItem = asCollectionItem();
  collectionItem.configure({
    family: SELECT_FAMILY,
    getMeta: (run) => {
      const props = run.props.get();
      return {
        value: props.value ?? '',
        textValue: props.textValue ?? props.value ?? '',
        disabled: !!props.disabled,
      };
    },
  });

  def.props.define({
    disabled: { type: 'boolean', empty: 'fallback' },
    value: { type: 'string', empty: 'fallback' },
    textValue: { type: 'string', empty: 'fallback' },
    closeOnSelect: { type: 'boolean', empty: 'fallback' },
  });
  def.props.setDefaults({ disabled: false, value: '', textValue: '' });

  def.expose.state('active', active);
  def.expose.state('selected', selected);
  def.expose.event('select', { payload: 'json' });
  def.a11y.role('option');
  def.a11y.nameFromContent();
  def.a11y.state('selected', selected);
  def.a11y.state('disabled', command.disabled);
  def.a11y.action('activate', { event: 'select' });

  const readContext = (run: any): SelectContextValue | null => {
    try {
      return run.context.read(SELECT_CONTEXT);
    } catch (error) {
      if ((error as { code?: string })?.code === 'CONTEXT_DISCONNECTED') return null;
      throw error;
    }
  };

  const sync = (run: any, ctx: SelectContextValue) => {
    const ownValue = run.props.get().value ?? '';
    const nextDisabled = !!run.props.get().disabled || ctx.disabled;
    command.syncDisabled(nextDisabled);
    if (!ctx.open) {
      command.resetInteraction('reason: select popup close => reset item interaction', {
        blur: true,
      });
    }
    const nextSelected = !!ownValue && ownValue === ctx.value;
    const nextActive =
      ctx.open &&
      !nextDisabled &&
      (command.focused.get() || (!!ownValue && ownValue === ctx.activeValue));
    selected.set(nextSelected, 'reason: select item selected sync');
    active.set(nextActive, 'reason: select item active sync');
    command.setRovingStatus({ selected: nextSelected, active: nextActive });
  };

  def.context.subscribe(SELECT_CONTEXT, (run, next) => sync(run, next));
  def.lifecycle.onMounted((run) => {
    const ctx = readContext(run);
    if (ctx) sync(run, ctx);
    notifySelectItemSnapshotChanged(run);
  });
  def.props.watch(['value', 'textValue', 'disabled'], (run) => {
    const ctx = readContext(run);
    if (ctx) sync(run, ctx);
    notifySelectItemSnapshotChanged(run);
  });

  const updateActiveValue = (run: any) => {
    if (command.disabled.get()) return;
    const ownValue = run.props.get().value ?? '';
    if (!ownValue) return;
    active.set(true, 'reason: select item interaction => active');
    command.setRovingStatus({ active: true, selected: selected.get() });
    run.context.update(SELECT_CONTEXT, (prev: SelectContextValue) =>
      prev.activeValue === ownValue ? prev : { ...prev, activeValue: ownValue }
    );
  };

  const clearTransientActive = (run: any, reason: string) => {
    const ctx = readContext(run);
    const ownValue = run.props.get().value ?? '';
    active.set(false, reason);
    command.setRovingStatus({ active: false, selected: selected.get() });
    if (!ctx?.open || !ownValue || ctx.activeValue !== ownValue) return;
    run.context.update(SELECT_CONTEXT, (prev: SelectContextValue) =>
      prev.activeValue === ownValue ? { ...prev, activeValue: '' } : prev
    );
  };

  def.event.on('press.commit', (run, ev) => {
    if (command.disabled.get()) return;
    const ctx = readContext(run);
    if (!ctx) return;
    const reason: SelectFocusReason = ev?.key ? 'keyboard' : 'pointer';
    const ownValue = run.props.get().value ?? '';
    const ownTextValue = run.props.get().textValue || ownValue;
    updateActiveValue(run);
    run.expose.emit('select', { value: ownValue, reason });
    requestSelectValue(run, { value: ownValue, textValue: ownTextValue, reason });

    const closeOnSelect = run.props.isProvided('closeOnSelect')
      ? !!run.props.get().closeOnSelect
      : ctx.closeOnSelect;
    if (closeOnSelect) {
      requestSelectOpen(run, { open: false, reason: 'item.select', focusReason: reason });
    }
  });

  command.focused.watch((run, event) => {
    if (event.type !== 'next') return;
    if (event.next) {
      updateActiveValue(run);
      return;
    }
    if (!command.hovered.get()) {
      clearTransientActive(run, 'reason: select item blur => clear transient active');
      return;
    }
    const ctx = readContext(run);
    if (ctx) sync(run, ctx);
  });
  def.event.on('pointer.enter', (run) => {
    const ctx = readContext(run);
    if (command.disabled.get() || !ctx?.open) return;
    updateActiveValue(run);
  });
  def.event.on('pointer.leave', (run) => {
    if (command.focused.get()) return;
    clearTransientActive(run, 'reason: select item pointer.leave => clear pointer active');
  });
}

export const asSelectItem = defineAsHook<
  SelectItemProps,
  SelectItemExposes,
  SelectItemAsHookContract
>({
  name: 'as-select-item',
  setup: setupSelectItem,
});

const selectItem = definePrototype({ name: 'base-select-item', setup: setupSelectItem });

export default selectItem;
