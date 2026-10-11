import { asAccessible } from '@proto.ui/hooks';
import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { createAlertDialogPartId, ALERT_DIALOG_CONTEXT, ALERT_DIALOG_FAMILY } from './shared';
import type {
  AlertDialogDescriptionAsHookContract,
  AlertDialogDescriptionExposes,
  AlertDialogDescriptionProps,
} from './types';

function setupAlertDialogDescription(
  def: DefHandle<AlertDialogDescriptionProps, AlertDialogDescriptionExposes>
): void {
  const accessible = asAccessible();

  def.anatomy.claim(ALERT_DIALOG_FAMILY, { role: 'description' });
  const id = def.state.string('alertDialogDescriptionId', '');
  accessible.id(id);
  def.context.subscribe(ALERT_DIALOG_CONTEXT, (_run, next) => {
    id.set(
      createAlertDialogPartId(next.rootId, 'description'),
      'reason: alertDialog description id sync'
    );
  });
  def.lifecycle.onCreated((run) => {
    id.set(
      createAlertDialogPartId(run.context.read(ALERT_DIALOG_CONTEXT).rootId, 'description'),
      'reason: alertDialog description created id sync'
    );
  });
}

export const asAlertDialogDescription = defineAsHook<
  AlertDialogDescriptionProps,
  AlertDialogDescriptionExposes,
  AlertDialogDescriptionAsHookContract
>({
  name: 'as-alert-dialog-description',
  setup: setupAlertDialogDescription,
});

const alertDialogDescription = definePrototype({
  name: 'base-alert-dialog-description',
  setup: setupAlertDialogDescription,
});

export default alertDialogDescription;
