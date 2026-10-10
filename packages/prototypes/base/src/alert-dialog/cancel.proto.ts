import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { setupAlertDialogCommand } from './command';
import {
  ALERT_DIALOG_CONTEXT,
  ALERT_DIALOG_FAMILY,
  requestAlertDialogOpen,
  type AlertDialogOpenFocusReason,
} from './shared';
import type {
  AlertDialogCancelAsHookContract,
  AlertDialogCancelExposes,
  AlertDialogCancelProps,
} from './types';

function setupAlertDialogCancel(
  def: DefHandle<AlertDialogCancelProps, AlertDialogCancelExposes>
): void {
  def.anatomy.claim(ALERT_DIALOG_FAMILY, { role: 'cancel' });
  const command = setupAlertDialogCommand(def, 'alertDialog cancel');

  def.context.subscribe(ALERT_DIALOG_CONTEXT, (run, next) => {
    command.syncDisabled(!!run.props.get().disabled || next.disabled);
  });

  def.lifecycle.onCreated((run) => {
    command.syncDisabled(
      !!run.props.get().disabled || run.context.read(ALERT_DIALOG_CONTEXT).disabled
    );
  });

  def.props.watch(['disabled'], (run, next) => {
    command.syncDisabled(!!next.disabled || run.context.read(ALERT_DIALOG_CONTEXT).disabled);
  });

  def.event.on('press.commit', (run, ev) => {
    if (command.disabled.get()) return;
    const returnFocusReason: AlertDialogOpenFocusReason = ev?.key ? 'keyboard' : 'pointer';
    requestAlertDialogOpen(run, false, 'cancel.press', returnFocusReason);
  });
}

export const asAlertDialogCancel = defineAsHook<
  AlertDialogCancelProps,
  AlertDialogCancelExposes,
  AlertDialogCancelAsHookContract
>({
  name: 'as-alert-dialog-cancel',
  setup: setupAlertDialogCancel,
});

const alertDialogCancel = definePrototype({
  name: 'base-alert-dialog-cancel',
  setup: setupAlertDialogCancel,
});

export default alertDialogCancel;
