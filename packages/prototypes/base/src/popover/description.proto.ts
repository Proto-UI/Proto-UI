import { asAccessible } from '@proto.ui/hooks';
import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { createPopoverPartId, POPOVER_CONTEXT, POPOVER_FAMILY } from './shared';
import type {
  PopoverDescriptionAsHookContract,
  PopoverDescriptionExposes,
  PopoverDescriptionProps,
} from './types';

function setupPopoverDescription(
  def: DefHandle<PopoverDescriptionProps, PopoverDescriptionExposes>
): void {
  const accessible = asAccessible();

  def.anatomy.claim(POPOVER_FAMILY, { role: 'description' });
  const id = def.state.string('popoverDescriptionId', '');
  accessible.id(id);
  def.context.subscribe(POPOVER_CONTEXT, (_run, next) => {
    id.set(createPopoverPartId(next.rootId, 'description'), 'reason: popover description id sync');
  });
  def.lifecycle.onCreated((run) => {
    id.set(
      createPopoverPartId(run.context.read(POPOVER_CONTEXT).rootId, 'description'),
      'reason: popover description created id sync'
    );
  });
}

export const asPopoverDescription = defineAsHook<
  PopoverDescriptionProps,
  PopoverDescriptionExposes,
  PopoverDescriptionAsHookContract
>({
  name: 'as-popover-description',
  setup: setupPopoverDescription,
});

const popoverDescription = definePrototype({
  name: 'base-popover-description',
  setup: setupPopoverDescription,
});

export default popoverDescription;
