import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { asAccessible, asCollectionItem } from '@proto.ui/hooks';
import { setupContextMenuCommand } from './command';
import {
  CONTEXT_MENU_CONTEXT,
  CONTEXT_MENU_FAMILY,
  requestContextMenuOpen,
  type ContextMenuFocusReason,
} from './shared';
import type {
  ContextMenuItemAsHookContract,
  ContextMenuItemExposes,
  ContextMenuItemProps,
} from './types';

function setupContextMenuItem(def: DefHandle<ContextMenuItemProps, ContextMenuItemExposes>): void {
  const accessible = asAccessible();

  const command = setupContextMenuCommand(def, 'contextMenu item', { focusableWhenDisabled: true });
  const active = def.state.bool('active', false);
  const collectionItem = asCollectionItem();
  collectionItem.configure({
    family: CONTEXT_MENU_FAMILY,
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

  accessible.role('menuitem');
  accessible.nameFromContent();
  accessible.state('disabled', command.disabled);
  accessible.action('activate', { event: 'select' });
  def.expose.state('active', active);
  def.expose.event('select', { payload: 'json' });

  const syncDisabled = (run: any) => {
    const ctx = run.context.read(CONTEXT_MENU_CONTEXT);
    command.syncDisabled(!!run.props.get().disabled || ctx.disabled);
  };
  const syncActive = (ctx: { open?: boolean; activeValue?: string }, ownValue: string) => {
    const nextActive =
      ctx.open !== false &&
      (command.focused.get() || (!!ownValue && ownValue === (ctx.activeValue ?? '')));
    active.set(nextActive, 'reason: contextMenu active sync');
    command.setRovingStatus({ active: nextActive });
  };
  def.context.subscribe(CONTEXT_MENU_CONTEXT, (run, next) => {
    syncDisabled(run);
    syncActive(next, run.props.get().value ?? '');
  });
  def.lifecycle.onMounted((run) => {
    syncDisabled(run);
    const currentRun = run as any;
    syncActive(currentRun.context.read(CONTEXT_MENU_CONTEXT), currentRun.props.get().value ?? '');
  });
  def.props.watch(['value', 'disabled'], (run, next) => {
    syncDisabled(run);
    syncActive(run.context.read(CONTEXT_MENU_CONTEXT), next.value ?? '');
  });

  const updateActiveValue = (run: any) => {
    const ownValue = run.props.get().value ?? '';
    if (!ownValue) return;
    active.set(true, 'reason: contextMenu item interaction => active');
    command.setRovingStatus({ active: true });
    run.context.update(CONTEXT_MENU_CONTEXT, (prev: any) =>
      prev.activeValue === ownValue ? prev : { ...prev, activeValue: ownValue }
    );
  };

  def.event.on('press.commit', (run, ev) => {
    if (command.disabled.get()) return;
    const ctx = run.context.read(CONTEXT_MENU_CONTEXT);
    const reason: ContextMenuFocusReason = ev?.key ? 'keyboard' : 'pointer';
    const value = run.props.get().value ?? '';
    updateActiveValue(run);
    run.expose.emit('select', { value, reason });
    const closeOnCommit = run.props.isProvided('closeOnCommit')
      ? !!run.props.get().closeOnCommit
      : ctx.closeOnItemCommit;
    if (closeOnCommit) requestContextMenuOpen(run, false, 'item.select', reason);
  });

  command.focused.watch((run, event) => {
    if (event.type !== 'next') return;
    if (event.next) {
      // Disabled items are intentionally included in menu focus navigation.
      updateActiveValue(run);
      return;
    }
    const currentRun = run as any;
    syncActive(currentRun.context.read(CONTEXT_MENU_CONTEXT), currentRun.props.get().value ?? '');
  });
  def.event.on('pointer.enter', (run) => {
    if (command.disabled.get()) return;
    if (!run.context.read(CONTEXT_MENU_CONTEXT).open) return;
    updateActiveValue(run);
  });
}

export const asContextMenuItem = defineAsHook<
  ContextMenuItemProps,
  ContextMenuItemExposes,
  ContextMenuItemAsHookContract
>({
  name: 'as-context-menu-item',
  setup: setupContextMenuItem,
});

const contextMenuItem = definePrototype({
  name: 'base-context-menu-item',
  setup: setupContextMenuItem,
});

export default contextMenuItem;
