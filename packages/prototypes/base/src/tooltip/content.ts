import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { TOOLTIP_FAMILY } from './shared';
import type {
  TooltipContentAsHookContract,
  TooltipContentExposes,
  TooltipContentProps,
} from './types';

/**
 * TooltipContent is the semantic content wrapper inside a TooltipOverlay.
 * It does not handle positioning or visibility — those are managed by
 * the parent TooltipOverlay part via asOverlay.
 */
function setupTooltipContent(def: DefHandle<TooltipContentProps, TooltipContentExposes>): void {
  def.anatomy.claim(TOOLTIP_FAMILY, { role: 'content' });
}

export const asTooltipContent = defineAsHook<
  TooltipContentProps,
  TooltipContentExposes,
  TooltipContentAsHookContract
>({
  name: 'as-tooltip-content',
  mode: 'once',
  setup: setupTooltipContent,
});

const tooltipContent = definePrototype({
  name: 'base-tooltip-content',
  setup: setupTooltipContent,
});

export default tooltipContent;
