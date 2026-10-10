import { asAccessible } from '@proto.ui/hooks';
import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { setupPopoverCommand } from './command';
import {
  createPopoverPartId,
  POPOVER_CONTEXT,
  POPOVER_FAMILY,
  requestPopoverOpen,
  type PopoverContextValue,
  type PopoverOpenFocusReason,
} from './shared';
import type {
  PopoverTriggerAsHookContract,
  PopoverTriggerExposes,
  PopoverTriggerProps,
} from './types';

function setupPopoverTrigger(def: DefHandle<PopoverTriggerProps, PopoverTriggerExposes>): void {
  const accessible = asAccessible();

  def.anatomy.claim(POPOVER_FAMILY, { role: 'trigger' });
  const command = setupPopoverCommand(def, 'popover trigger');
  const expanded = def.state.bool('popoverExpanded', false);
  const hasPopup = def.state.string('popoverHasPopup', 'dialog');
  const controls = def.state.string('popoverContentId', '');

  accessible.state('expanded', expanded);
  accessible.state('hasPopup', hasPopup);
  accessible.relation('controls', { target: controls });

  const syncPopoverFacts = (ctx: PopoverContextValue) => {
    expanded.set(ctx.open, 'reason: popover trigger expanded sync');
    controls.set(
      createPopoverPartId(ctx.rootId, 'content'),
      'reason: popover trigger controls sync'
    );
  };

  def.context.subscribe(POPOVER_CONTEXT, (run, next) => {
    command.syncDisabled(!!run.props.get().disabled || next.disabled);
    syncPopoverFacts(next);
  });

  def.lifecycle.onCreated((run) => {
    const ctx = run.context.read(POPOVER_CONTEXT);
    command.syncDisabled(!!run.props.get().disabled || ctx.disabled);
    syncPopoverFacts(ctx);
  });

  def.props.watch(['disabled'], (run, next) => {
    command.syncDisabled(!!next.disabled || run.context.read(POPOVER_CONTEXT).disabled);
  });

  def.event.on('press.commit', (run, ev) => {
    const ctx = run.context.read(POPOVER_CONTEXT);
    if (command.disabled.get()) return;
    const openFocusReason: PopoverOpenFocusReason = ev?.key ? 'keyboard' : 'pointer';
    requestPopoverOpen(run, !ctx.open, 'trigger.press', openFocusReason);
  });
}

export const asPopoverTrigger = defineAsHook<
  PopoverTriggerProps,
  PopoverTriggerExposes,
  PopoverTriggerAsHookContract
>({
  name: 'as-popover-trigger',
  setup: setupPopoverTrigger,
});

const popoverTrigger = definePrototype({
  name: 'base-popover-trigger',
  setup: setupPopoverTrigger,
});

export default popoverTrigger;
