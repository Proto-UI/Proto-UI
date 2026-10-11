import { asAccessible } from '@proto.ui/hooks';
import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { setupDrawerCommand } from './command';
import {
  createDrawerPartId,
  DRAWER_CONTEXT,
  DRAWER_FAMILY,
  requestDrawerOpen,
  type DrawerContextValue,
  type DrawerOpenFocusReason,
} from './shared';
import type {
  DrawerTriggerAsHookContract,
  DrawerTriggerExposes,
  DrawerTriggerProps,
} from './types';

function setupDrawerTrigger(def: DefHandle<DrawerTriggerProps, DrawerTriggerExposes>): void {
  const accessible = asAccessible();

  def.anatomy.claim(DRAWER_FAMILY, { role: 'trigger' });
  const command = setupDrawerCommand(def, 'drawer trigger');
  const expanded = def.state.bool('drawerExpanded', false);
  const hasPopup = def.state.string('drawerHasPopup', 'dialog');
  const controls = def.state.string('drawerContentId', '');

  accessible.state('expanded', expanded);
  accessible.state('hasPopup', hasPopup);
  accessible.relation('controls', { target: controls });

  const syncDrawerFacts = (ctx: DrawerContextValue) => {
    expanded.set(ctx.open, 'reason: drawer trigger expanded sync');
    controls.set(createDrawerPartId(ctx.rootId, 'content'), 'reason: drawer trigger controls sync');
  };

  def.context.subscribe(DRAWER_CONTEXT, (run, next) => {
    command.syncDisabled(!!run.props.get().disabled || next.disabled);
    syncDrawerFacts(next);
  });

  def.lifecycle.onCreated((run) => {
    const ctx = run.context.read(DRAWER_CONTEXT);
    command.syncDisabled(!!run.props.get().disabled || ctx.disabled);
    syncDrawerFacts(ctx);
  });

  def.props.watch(['disabled'], (run, next) => {
    command.syncDisabled(!!next.disabled || run.context.read(DRAWER_CONTEXT).disabled);
  });

  def.event.on('press.commit', (run, ev) => {
    const ctx = run.context.read(DRAWER_CONTEXT);
    if (command.disabled.get()) return;
    const openFocusReason: DrawerOpenFocusReason = ev?.key ? 'keyboard' : 'pointer';
    requestDrawerOpen(run, !ctx.open, 'trigger.press', openFocusReason);
  });
}

export const asDrawerTrigger = defineAsHook<
  DrawerTriggerProps,
  DrawerTriggerExposes,
  DrawerTriggerAsHookContract
>({
  name: 'as-drawer-trigger',
  setup: setupDrawerTrigger,
});

const drawerTrigger = definePrototype({
  name: 'base-drawer-trigger',
  setup: setupDrawerTrigger,
});

export default drawerTrigger;
