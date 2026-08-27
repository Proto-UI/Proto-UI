import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { asCollectionItem } from '@proto.ui/hooks';
import { setupDropdownCommand } from './command';
import {
  DROPDOWN_CONTEXT,
  DROPDOWN_FAMILY,
  requestDropdownOpen,
  type DropdownFocusReason,
} from './shared';
import type { DropdownItemAsHookContract, DropdownItemExposes, DropdownItemProps } from './types';

function setupDropdownItem(def: DefHandle<DropdownItemProps, DropdownItemExposes>): void {
  // P-BASE-DROPDOWN-MENU-ITEM-DISABLED: disabled menu items remain focusable.
  const command = setupDropdownCommand(def, 'dropdown item', { focusableWhenDisabled: true });
  const active = def.state.bool('active', false);
  const collectionItem = asCollectionItem();
  collectionItem.configure({
    family: DROPDOWN_FAMILY,
    getMeta: (run) => {
      const props = run.props.get();
      return {
        value: props.value ?? '',
        textValue: props.textValue ?? '',
        disabled: !!props.disabled,
      };
    },
  });

  def.props.define({
    disabled: { type: 'boolean', empty: 'fallback' },
    value: { type: 'string', empty: 'fallback' },
    textValue: { type: 'string', empty: 'fallback' },
    closeOnCommit: { type: 'boolean', empty: 'fallback' },
  });
  def.props.setDefaults({ disabled: false, value: '', textValue: '' });

  // P-BASE-DROPDOWN-MENU-ITEM-A11Y
  def.a11y.role('menuitem');
  def.a11y.nameFromContent();
  def.a11y.state('disabled', command.disabled);
  def.a11y.action('activate', { event: 'select' });
  def.expose.state('active', active);
  def.expose.event('select', { payload: 'json' });

  const syncDisabled = (run: any) => {
    const ctx = run.context.read(DROPDOWN_CONTEXT);
    command.syncDisabled(!!run.props.get().disabled || ctx.disabled);
  };
  const syncActive = (ctx: { open?: boolean; activeValue?: string }, ownValue: string) => {
    const nextActive =
      ctx.open !== false &&
      (command.focused.get() || (!!ownValue && ownValue === (ctx.activeValue ?? '')));
    active.set(nextActive, 'reason: dropdown active sync');
    command.setRovingStatus({ active: nextActive });
  };
  def.context.subscribe(DROPDOWN_CONTEXT, (run, next) => {
    syncDisabled(run);
    syncActive(next, run.props.get().value ?? '');
  });
  def.lifecycle.onMounted((run) => {
    syncDisabled(run);
    const currentRun = run as any;
    syncActive(currentRun.context.read(DROPDOWN_CONTEXT), currentRun.props.get().value ?? '');
  });
  def.props.watch(['value', 'disabled'], (run, next) => {
    syncDisabled(run);
    syncActive(run.context.read(DROPDOWN_CONTEXT), next.value ?? '');
  });

  const updateActiveValue = (run: any) => {
    const ownValue = run.props.get().value ?? '';
    if (!ownValue) return;
    active.set(true, 'reason: dropdown item interaction => active');
    command.setRovingStatus({ active: true });
    run.context.update(DROPDOWN_CONTEXT, (prev: any) =>
      prev.activeValue === ownValue ? prev : { ...prev, activeValue: ownValue }
    );
  };

  def.event.on('press.commit', (run, ev) => {
    // P-BASE-DROPDOWN-MENU-ITEM-SELECT, P-BASE-DROPDOWN-MENU-ITEM-DISABLED
    if (command.disabled.get()) return;
    const ctx = run.context.read(DROPDOWN_CONTEXT);
    const reason: DropdownFocusReason = ev?.key ? 'keyboard' : 'pointer';
    const value = run.props.get().value ?? '';
    updateActiveValue(run);
    run.expose.emit('select', { value, reason });
    const closeOnCommit = run.props.isProvided('closeOnCommit')
      ? !!run.props.get().closeOnCommit
      : ctx.closeOnItemCommit;
    if (closeOnCommit) requestDropdownOpen(run, false, 'item.select', reason);
  });

  command.focused.watch((run, event) => {
    if (event.type !== 'next') return;
    if (event.next) {
      // Disabled items are intentionally included in menu focus navigation.
      updateActiveValue(run);
      return;
    }
    const currentRun = run as any;
    syncActive(currentRun.context.read(DROPDOWN_CONTEXT), currentRun.props.get().value ?? '');
  });
  def.event.on('pointer.enter', (run) => {
    if (command.disabled.get()) return;
    if (!run.context.read(DROPDOWN_CONTEXT).open) return;
    updateActiveValue(run);
  });
}

// P-BASE-DROPDOWN-MENU-ITEM-AUTHORING-ENTRIES
export const asDropdownItem = defineAsHook<
  DropdownItemProps,
  DropdownItemExposes,
  DropdownItemAsHookContract
>({
  name: 'as-dropdown-item',
  setup: setupDropdownItem,
});

const dropdownItem = definePrototype({
  name: 'base-dropdown-item',
  setup: setupDropdownItem,
});

export default dropdownItem;
