import { asAccessible } from '@proto.ui/hooks';
import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { createAlertDialogPartId, ALERT_DIALOG_CONTEXT, ALERT_DIALOG_FAMILY } from './shared';
import type {
  AlertDialogTitleAsHookContract,
  AlertDialogTitleExposes,
  AlertDialogTitleProps,
} from './types';

function setupAlertDialogTitle(
  def: DefHandle<AlertDialogTitleProps, AlertDialogTitleExposes>
): void {
  const accessible = asAccessible();

  def.anatomy.claim(ALERT_DIALOG_FAMILY, { role: 'title' });
  const id = def.state.string('alertDialogTitleId', '');
  accessible.id(id);
  accessible.nameFromContent();
  def.context.subscribe(ALERT_DIALOG_CONTEXT, (_run, next) => {
    id.set(createAlertDialogPartId(next.rootId, 'title'), 'reason: alertDialog title id sync');
  });
  def.lifecycle.onCreated((run) => {
    id.set(
      createAlertDialogPartId(run.context.read(ALERT_DIALOG_CONTEXT).rootId, 'title'),
      'reason: alertDialog title created id sync'
    );
  });
}

export const asAlertDialogTitle = defineAsHook<
  AlertDialogTitleProps,
  AlertDialogTitleExposes,
  AlertDialogTitleAsHookContract
>({
  name: 'as-alert-dialog-title',
  setup: setupAlertDialogTitle,
});

const alertDialogTitle = definePrototype({
  name: 'base-alert-dialog-title',
  setup: setupAlertDialogTitle,
});

export default alertDialogTitle;
