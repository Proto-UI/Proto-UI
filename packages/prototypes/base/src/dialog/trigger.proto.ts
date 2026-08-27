import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { setupDialogCommand } from './command';
import {
  createDialogPartId,
  DIALOG_CONTEXT,
  DIALOG_FAMILY,
  requestDialogOpen,
  type DialogContextValue,
  type DialogOpenFocusReason,
} from './shared';
import type {
  DialogTriggerAsHookContract,
  DialogTriggerExposes,
  DialogTriggerProps,
} from './types';

function setupDialogTrigger(def: DefHandle<DialogTriggerProps, DialogTriggerExposes>): void {
  // P-BASE-DIALOG-TRIGGER-COMMAND, P-BASE-DIALOG-TRIGGER-NO-BUTTON-DEPENDENCY
  def.anatomy.claim(DIALOG_FAMILY, { role: 'trigger' });
  const command = setupDialogCommand(def, 'dialog trigger');
  const expanded = def.state.bool('dialogExpanded', false);
  const hasPopup = def.state.string('dialogHasPopup', 'dialog');
  const controls = def.state.string('dialogContentId', '');
  // P-BASE-DIALOG-TRIGGER-A11Y
  def.a11y.state('expanded', expanded);
  def.a11y.state('hasPopup', hasPopup);
  def.a11y.relation('controls', { target: controls });

  const syncDialogFacts = (ctx: DialogContextValue) => {
    expanded.set(ctx.open, 'reason: dialog trigger expanded sync');
    controls.set(createDialogPartId(ctx.rootId, 'content'), 'reason: dialog trigger controls sync');
  };

  def.context.subscribe(DIALOG_CONTEXT, (run, next) => {
    // P-BASE-DIALOG-TRIGGER-DISABLED, P-BASE-DIALOG-TRIGGER-A11Y
    command.syncDisabled(!!run.props.get().disabled || next.disabled);
    syncDialogFacts(next);
  });

  def.lifecycle.onCreated((run) => {
    const ctx = run.context.read(DIALOG_CONTEXT);
    command.syncDisabled(!!run.props.get().disabled || ctx.disabled);
    syncDialogFacts(ctx);
  });

  def.props.watch(['disabled'], (run, next) => {
    command.syncDisabled(!!next.disabled || run.context.read(DIALOG_CONTEXT).disabled);
  });

  def.event.on('press.commit', (run, ev) => {
    // P-BASE-DIALOG-TRIGGER-REQUEST, P-BASE-DIALOG-TRIGGER-DISABLED
    const ctx = run.context.read(DIALOG_CONTEXT);
    if (command.disabled.get()) return;
    const openFocusReason: DialogOpenFocusReason = ev?.key ? 'keyboard' : 'pointer';
    requestDialogOpen(run, !ctx.open, 'trigger.press', openFocusReason);
  });
}

// P-BASE-DIALOG-TRIGGER-AUTHORING-ENTRIES
export const asDialogTrigger = defineAsHook<
  DialogTriggerProps,
  DialogTriggerExposes,
  DialogTriggerAsHookContract
>({
  name: 'as-dialog-trigger',
  setup: setupDialogTrigger,
});

const dialogTrigger = definePrototype({
  name: 'base-dialog-trigger',
  setup: setupDialogTrigger,
});

export default dialogTrigger;
