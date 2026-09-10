import { asAccessible } from '@proto.ui/hooks';
import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { createDialogPartId, DIALOG_CONTEXT, DIALOG_FAMILY } from './shared';
import type { DialogTitleAsHookContract, DialogTitleExposes, DialogTitleProps } from './types';

function setupDialogTitle(def: DefHandle<DialogTitleProps, DialogTitleExposes>): void {
  const accessible = asAccessible();
  // P-BASE-DIALOG-TITLE-LABEL
  def.anatomy.claim(DIALOG_FAMILY, { role: 'title' });
  const id = def.state.string('dialogTitleId', '');
  accessible.id(id);
  accessible.nameFromContent();
  def.context.subscribe(DIALOG_CONTEXT, (_run, next) => {
    id.set(createDialogPartId(next.rootId, 'title'), 'reason: dialog title id sync');
  });
  def.lifecycle.onCreated((run) => {
    id.set(
      createDialogPartId(run.context.read(DIALOG_CONTEXT).rootId, 'title'),
      'reason: dialog title created id sync'
    );
  });
}

/*
 * P-BASE-DIALOG-TITLE-NO-BEHAVIOR: absence of event, open, and focus syntax is the implementation.
 */

// P-BASE-DIALOG-TITLE-AUTHORING-ENTRIES
export const asDialogTitle = defineAsHook<
  DialogTitleProps,
  DialogTitleExposes,
  DialogTitleAsHookContract
>({
  name: 'as-dialog-title',
  setup: setupDialogTitle,
});

const dialogTitle = definePrototype({
  name: 'base-dialog-title',
  setup: setupDialogTitle,
});

export default dialogTitle;
