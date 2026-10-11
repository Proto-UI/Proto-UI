import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { setupDrawerCommand } from './command';
import {
  DRAWER_CONTEXT,
  DRAWER_FAMILY,
  requestDrawerOpen,
  type DrawerOpenFocusReason,
} from './shared';
import type { DrawerCloseAsHookContract, DrawerCloseExposes, DrawerCloseProps } from './types';

function setupDrawerClose(def: DefHandle<DrawerCloseProps, DrawerCloseExposes>): void {
  def.anatomy.claim(DRAWER_FAMILY, { role: 'close' });
  const command = setupDrawerCommand(def, 'drawer close');

  def.context.subscribe(DRAWER_CONTEXT, (run, next) => {
    command.syncDisabled(!!run.props.get().disabled || next.disabled);
  });

  def.lifecycle.onCreated((run) => {
    command.syncDisabled(!!run.props.get().disabled || run.context.read(DRAWER_CONTEXT).disabled);
  });

  def.props.watch(['disabled'], (run, next) => {
    command.syncDisabled(!!next.disabled || run.context.read(DRAWER_CONTEXT).disabled);
  });

  def.event.on('press.commit', (run, ev) => {
    if (command.disabled.get()) return;
    const returnFocusReason: DrawerOpenFocusReason = ev?.key ? 'keyboard' : 'pointer';
    requestDrawerOpen(run, false, 'close.press', returnFocusReason);
  });
}

export const asDrawerClose = defineAsHook<
  DrawerCloseProps,
  DrawerCloseExposes,
  DrawerCloseAsHookContract
>({
  name: 'as-drawer-close',
  setup: setupDrawerClose,
});

const drawerClose = definePrototype({
  name: 'base-drawer-close',
  setup: setupDrawerClose,
});

export default drawerClose;
