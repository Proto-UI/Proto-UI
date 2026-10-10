import { asAccessible } from '@proto.ui/hooks';
import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { setupContextMenuCommand } from './command';
import {
  createContextMenuContentId,
  CONTEXT_MENU_CONTEXT,
  CONTEXT_MENU_FAMILY,
  requestContextMenuOpen,
  type ContextMenuContextValue,
} from './shared';
import type {
  ContextMenuTriggerAsHookContract,
  ContextMenuTriggerExposes,
  ContextMenuTriggerProps,
} from './types';

function setupContextMenuTrigger(
  def: DefHandle<ContextMenuTriggerProps, ContextMenuTriggerExposes>
): void {
  const accessible = asAccessible();

  def.anatomy.claim(CONTEXT_MENU_FAMILY, { role: 'trigger' });
  const command = setupContextMenuCommand(def, 'contextMenu trigger');

  const expanded = def.state.bool('contextMenuExpanded', false);
  const hasPopup = def.state.string('contextMenuHasPopup', 'menu');
  const controls = def.state.string('contextMenuContentId', '');

  accessible.role('group');
  accessible.nameFromContent();
  accessible.state('disabled', command.disabled);
  accessible.state('expanded', expanded);
  accessible.state('hasPopup', hasPopup);
  accessible.relation('controls', { target: controls });
  accessible.action('activate', { event: 'click' });

  const sync = (run: any, ctx: ContextMenuContextValue) => {
    command.syncDisabled(!!run.props.get().disabled || ctx.disabled);
    expanded.set(ctx.open, 'reason: contextMenu trigger expanded sync');
    controls.set(
      createContextMenuContentId(ctx.rootId),
      'reason: contextMenu trigger controls sync'
    );
  };
  def.context.subscribe(CONTEXT_MENU_CONTEXT, (run, next) => sync(run, next));
  def.lifecycle.onCreated((run) => sync(run, run.context.read(CONTEXT_MENU_CONTEXT)));
  def.props.watch(['disabled'], (run) => sync(run, run.context.read(CONTEXT_MENU_CONTEXT)));

  command.focused.watch((run, event) => {
    if (event.type !== 'next' || !event.next) return;
    const ctx = run.context.read(CONTEXT_MENU_CONTEXT);
    if (!ctx.open || !ctx.activeValue) return;
    run.context.update(CONTEXT_MENU_CONTEXT, (prev) => ({ ...prev, activeValue: '' }));
  });

  const openAtTarget = (run: any, event: any, reason: 'pointer' | 'keyboard') => {
    if (command.disabled.get()) return;
    event.control.requestDefaultActionPrevention({
      reason: 'context-menu.open',
      source: 'base-context-menu-trigger',
    });
    requestContextMenuOpen(run, true, 'context.menu', reason, 'first');
  };
  def.event.on('context.menu', (run, event) => openAtTarget(run, event, 'pointer'));
  def.event.on('key.down', (run, event) => {
    if (!command.focused.get()) return;
    if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey))
      openAtTarget(run, event, 'keyboard');
  });
}

export const asContextMenuTrigger = defineAsHook<
  ContextMenuTriggerProps,
  ContextMenuTriggerExposes,
  ContextMenuTriggerAsHookContract
>({
  name: 'as-context-menu-trigger',
  setup: setupContextMenuTrigger,
});

const contextMenuTrigger = definePrototype({
  name: 'base-context-menu-trigger',
  setup: setupContextMenuTrigger,
});

export default contextMenuTrigger;
