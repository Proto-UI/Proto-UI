import { defineAsHook, definePrototype, type DefHandle, type RunHandle } from '@proto.ui/core';
import { asFocusable } from '@proto.ui/hooks';
import {
  createTooltipContentId,
  TOOLTIP_CONTEXT,
  TOOLTIP_FAMILY,
  updateTooltipInteraction,
  type TooltipContextValue,
} from './shared';
import type {
  TooltipTriggerAsHookContract,
  TooltipTriggerExposes,
  TooltipTriggerProps,
} from './types';

function setupTooltipTrigger(def: DefHandle<TooltipTriggerProps, TooltipTriggerExposes>): void {
  def.anatomy.claim(TOOLTIP_FAMILY, { role: 'trigger' });
  def.props.define({ disabled: { type: 'boolean', empty: 'fallback' } });
  def.props.setDefaults({ disabled: false });

  const disabled = def.state.bool('disabled', false);
  const hovered = def.state.bool('hovered', false);
  const describedBy = def.state.string('tooltipContentId', '');
  const focusable = asFocusable<TooltipTriggerProps>();
  focusable.configure({ disabled: false });
  const focused = focusable.focused;
  const focusVisible = focusable.focusVisible;

  def.a11y.relation('describedBy', { target: describedBy, mode: 'append' });
  def.expose.state('disabled', disabled);
  def.expose.state('hovered', hovered);
  def.expose.state('focused', focused);
  def.expose.state('focusVisible', focusVisible);
  def.expose.method('focusSelf', (options) => {
    if (!disabled.get()) focusable.focusSelf(options);
  });

  const syncContext = (run: RunHandle<TooltipTriggerProps>, ctx: TooltipContextValue) => {
    const nextDisabled = !!run.props.get().disabled || ctx.disabled;
    disabled.set(nextDisabled, 'reason: tooltip trigger disabled sync');
    focusable.setDisabled(nextDisabled);
    const contentPresent = run.anatomy.partsOf(TOOLTIP_FAMILY, 'content').length > 0;
    describedBy.set(
      ctx.open && contentPresent ? createTooltipContentId(ctx.rootId) : '',
      'reason: tooltip trigger describedBy sync'
    );
    if (!nextDisabled) return;
    hovered.set(false, 'reason: tooltip trigger disabled');
    if (!ctx.triggerHovered && !ctx.triggerFocused) return;
    updateTooltipInteraction(
      run,
      { triggerHovered: false, triggerFocused: false },
      'trigger.pointerleave'
    );
  };

  def.context.subscribe(TOOLTIP_CONTEXT, (run, next) => syncContext(run, next));
  def.anatomy.subscribeParts(TOOLTIP_FAMILY, 'content', (run) => {
    try {
      syncContext(run, run.context.read(TOOLTIP_CONTEXT));
    } catch (error) {
      if ((error as { code?: string })?.code !== 'CONTEXT_DISCONNECTED') throw error;
    }
  });
  def.props.watch(['disabled'], (run) => syncContext(run, run.context.read(TOOLTIP_CONTEXT)));
  def.lifecycle.onCreated((run) => syncContext(run, run.context.read(TOOLTIP_CONTEXT)));

  def.event.on('pointer.enter', (run) => {
    if (disabled.get()) return;
    hovered.set(true, 'reason: tooltip trigger pointer.enter');
    updateTooltipInteraction(run, { triggerHovered: true }, 'trigger.pointerenter');
  });
  def.event.on('pointer.leave', (run) => {
    hovered.set(false, 'reason: tooltip trigger pointer.leave');
    updateTooltipInteraction(run, { triggerHovered: false }, 'trigger.pointerleave');
  });

  focused.watch((run, event) => {
    if (event.type !== 'next') return;
    updateTooltipInteraction(
      run,
      { triggerFocused: event.next },
      event.next ? 'trigger.focus' : 'trigger.blur'
    );
  });
}

export const asTooltipTrigger = defineAsHook<
  TooltipTriggerProps,
  TooltipTriggerExposes,
  TooltipTriggerAsHookContract
>({ name: 'as-tooltip-trigger', setup: setupTooltipTrigger });

const tooltipTrigger = definePrototype<TooltipTriggerProps, TooltipTriggerExposes>({
  name: 'base-tooltip-trigger',
  setup: setupTooltipTrigger,
});

export default tooltipTrigger;
