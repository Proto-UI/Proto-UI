import { asAccessible } from '@proto.ui/hooks';
import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { setupAlertDialogCommand } from './command';
import {
  createAlertDialogPartId,
  ALERT_DIALOG_CONTEXT,
  ALERT_DIALOG_FAMILY,
  requestAlertDialogOpen,
  type AlertDialogContextValue,
  type AlertDialogOpenFocusReason,
} from './shared';
import type {
  AlertDialogTriggerAsHookContract,
  AlertDialogTriggerExposes,
  AlertDialogTriggerProps,
} from './types';

function setupAlertDialogTrigger(
  def: DefHandle<AlertDialogTriggerProps, AlertDialogTriggerExposes>
): void {
  const accessible = asAccessible();

  def.anatomy.claim(ALERT_DIALOG_FAMILY, { role: 'trigger' });
  const command = setupAlertDialogCommand(def, 'alertDialog trigger');
  const expanded = def.state.bool('alertDialogExpanded', false);
  const hasPopup = def.state.string('alertDialogHasPopup', 'dialog');
  const controls = def.state.string('alertDialogContentId', '');

  accessible.state('expanded', expanded);
  accessible.state('hasPopup', hasPopup);
  accessible.relation('controls', { target: controls });

  const syncAlertDialogFacts = (ctx: AlertDialogContextValue) => {
    expanded.set(ctx.open, 'reason: alertDialog trigger expanded sync');
    controls.set(
      createAlertDialogPartId(ctx.rootId, 'content'),
      'reason: alertDialog trigger controls sync'
    );
  };

  def.context.subscribe(ALERT_DIALOG_CONTEXT, (run, next) => {
    command.syncDisabled(!!run.props.get().disabled || next.disabled);
    syncAlertDialogFacts(next);
  });

  def.lifecycle.onCreated((run) => {
    const ctx = run.context.read(ALERT_DIALOG_CONTEXT);
    command.syncDisabled(!!run.props.get().disabled || ctx.disabled);
    syncAlertDialogFacts(ctx);
  });

  def.props.watch(['disabled'], (run, next) => {
    command.syncDisabled(!!next.disabled || run.context.read(ALERT_DIALOG_CONTEXT).disabled);
  });

  def.event.on('press.commit', (run, ev) => {
    const ctx = run.context.read(ALERT_DIALOG_CONTEXT);
    if (command.disabled.get()) return;
    const openFocusReason: AlertDialogOpenFocusReason = ev?.key ? 'keyboard' : 'pointer';
    requestAlertDialogOpen(run, !ctx.open, 'trigger.press', openFocusReason);
  });
}

export const asAlertDialogTrigger = defineAsHook<
  AlertDialogTriggerProps,
  AlertDialogTriggerExposes,
  AlertDialogTriggerAsHookContract
>({
  name: 'as-alert-dialog-trigger',
  setup: setupAlertDialogTrigger,
});

const alertDialogTrigger = definePrototype({
  name: 'base-alert-dialog-trigger',
  setup: setupAlertDialogTrigger,
});

export default alertDialogTrigger;
