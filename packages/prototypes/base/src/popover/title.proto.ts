import { asAccessible } from '@proto.ui/hooks';
import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { createPopoverPartId, POPOVER_CONTEXT, POPOVER_FAMILY } from './shared';
import type { PopoverTitleAsHookContract, PopoverTitleExposes, PopoverTitleProps } from './types';

function setupPopoverTitle(def: DefHandle<PopoverTitleProps, PopoverTitleExposes>): void {
  const accessible = asAccessible();

  def.anatomy.claim(POPOVER_FAMILY, { role: 'title' });
  const id = def.state.string('popoverTitleId', '');
  accessible.id(id);
  accessible.nameFromContent();
  def.context.subscribe(POPOVER_CONTEXT, (_run, next) => {
    id.set(createPopoverPartId(next.rootId, 'title'), 'reason: popover title id sync');
  });
  def.lifecycle.onCreated((run) => {
    id.set(
      createPopoverPartId(run.context.read(POPOVER_CONTEXT).rootId, 'title'),
      'reason: popover title created id sync'
    );
  });
}

export const asPopoverTitle = defineAsHook<
  PopoverTitleProps,
  PopoverTitleExposes,
  PopoverTitleAsHookContract
>({
  name: 'as-popover-title',
  setup: setupPopoverTitle,
});

const popoverTitle = definePrototype({
  name: 'base-popover-title',
  setup: setupPopoverTitle,
});

export default popoverTitle;
