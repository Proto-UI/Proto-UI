import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { setupDialogCommand } from './command';
import {
  DIALOG_CONTEXT,
  DIALOG_FAMILY,
  requestDialogOpen,
  type DialogOpenFocusReason,
} from './shared';
import type { DialogCloseAsHookContract, DialogCloseExposes, DialogCloseProps } from './types';

function setupDialogClose(def: DefHandle<DialogCloseProps, DialogCloseExposes>): void {
  // P-BASE-DIALOG-CLOSE-COMMAND, P-BASE-DIALOG-CLOSE-NO-BUTTON-DEPENDENCY
  def.anatomy.claim(DIALOG_FAMILY, { role: 'close' });
  const command = setupDialogCommand(def, 'dialog close');

  def.context.subscribe(DIALOG_CONTEXT, (run, next) => {
    // P-BASE-DIALOG-CLOSE-DISABLED
    command.syncDisabled(!!run.props.get().disabled || next.disabled);
  });

  def.lifecycle.onCreated((run) => {
    command.syncDisabled(!!run.props.get().disabled || run.context.read(DIALOG_CONTEXT).disabled);
  });

  def.props.watch(['disabled'], (run, next) => {
    command.syncDisabled(!!next.disabled || run.context.read(DIALOG_CONTEXT).disabled);
  });

  def.event.on('press.commit', (run, ev) => {
    // P-BASE-DIALOG-CLOSE-REQUEST, P-BASE-DIALOG-CLOSE-DISABLED
    if (command.disabled.get()) return;
    const returnFocusReason: DialogOpenFocusReason = ev?.key ? 'keyboard' : 'pointer';
    requestDialogOpen(run, false, 'close.press', returnFocusReason);
  });
}

// P-BASE-DIALOG-CLOSE-AUTHORING-ENTRIES
export const asDialogClose = defineAsHook<
  DialogCloseProps,
  DialogCloseExposes,
  DialogCloseAsHookContract
>({
  name: 'as-dialog-close',
  setup: setupDialogClose,
});

const dialogClose = definePrototype({
  name: 'base-dialog-close',
  setup: setupDialogClose,
});

export default dialogClose;
