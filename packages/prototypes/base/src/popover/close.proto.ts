import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { setupPopoverCommand } from './command';
import {
  POPOVER_CONTEXT,
  POPOVER_FAMILY,
  requestPopoverOpen,
  type PopoverOpenFocusReason,
} from './shared';
import type { PopoverCloseAsHookContract, PopoverCloseExposes, PopoverCloseProps } from './types';

function setupPopoverClose(def: DefHandle<PopoverCloseProps, PopoverCloseExposes>): void {
  def.anatomy.claim(POPOVER_FAMILY, { role: 'close' });
  const command = setupPopoverCommand(def, 'popover close');

  def.context.subscribe(POPOVER_CONTEXT, (run, next) => {
    command.syncDisabled(!!run.props.get().disabled || next.disabled);
  });

  def.lifecycle.onCreated((run) => {
    command.syncDisabled(!!run.props.get().disabled || run.context.read(POPOVER_CONTEXT).disabled);
  });

  def.props.watch(['disabled'], (run, next) => {
    command.syncDisabled(!!next.disabled || run.context.read(POPOVER_CONTEXT).disabled);
  });

  def.event.on('press.commit', (run, ev) => {
    if (command.disabled.get()) return;
    const returnFocusReason: PopoverOpenFocusReason = ev?.key ? 'keyboard' : 'pointer';
    requestPopoverOpen(run, false, 'close.press', returnFocusReason);
  });
}

export const asPopoverClose = defineAsHook<
  PopoverCloseProps,
  PopoverCloseExposes,
  PopoverCloseAsHookContract
>({
  name: 'as-popover-close',
  setup: setupPopoverClose,
});

const popoverClose = definePrototype({
  name: 'base-popover-close',
  setup: setupPopoverClose,
});

export default popoverClose;
