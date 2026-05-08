import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { asFocusGroup } from '@proto.ui/hooks';
import { TOOLTIP_GROUP_CONTEXT, type TooltipGroupContextValue } from './shared';
import type { TooltipGroupAsHookContract, TooltipGroupExposes, TooltipGroupProps } from './types';

function setupTooltipGroup(def: DefHandle<TooltipGroupProps, TooltipGroupExposes>): void {
  def.props.define({
    skipDelayDuration: { type: 'number', empty: 'fallback' },
  });
  def.props.setDefaults({
    skipDelayDuration: 0,
  });

  asFocusGroup({ meta: { kind: 'tooltip-group' } });

  const updateContext = def.context.provide(TOOLTIP_GROUP_CONTEXT, {
    openCount: 0,
    skipDelayDuration: 0,
  });

  def.context.subscribe(TOOLTIP_GROUP_CONTEXT, (_run, next) => {
    // Re-publish so downstream roots see updated openCount from siblings.
  });

  def.lifecycle.onCreated((run) => {
    const skipDelay = run.props.get().skipDelayDuration ?? 0;
    updateContext((prev: TooltipGroupContextValue) => ({
      ...prev,
      skipDelayDuration: skipDelay,
    }));
  });

  def.props.watch(['skipDelayDuration'], (_run, next) => {
    updateContext((prev: TooltipGroupContextValue) => ({
      ...prev,
      skipDelayDuration: next.skipDelayDuration ?? 0,
    }));
  });
}

export const asTooltipGroup = defineAsHook<
  TooltipGroupProps,
  TooltipGroupExposes,
  TooltipGroupAsHookContract
>({
  name: 'as-tooltip-group',
  mode: 'once',
  setup: setupTooltipGroup,
});

const tooltipGroup = definePrototype({
  name: 'base-tooltip-group',
  setup: setupTooltipGroup,
});

export default tooltipGroup;
