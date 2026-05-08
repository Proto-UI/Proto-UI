import { defineAsHook, definePrototype, tw, type DefHandle } from '@proto.ui/core';
import { TOOLTIP_FAMILY } from './shared';
import type { TooltipArrowAsHookContract, TooltipArrowExposes, TooltipArrowProps } from './types';

/**
 * TooltipArrow renders a decorative arrow/indicator pointing from the
 * tooltip overlay toward the trigger element. It claims the 'arrow'
 * anatomy role and relies on the parent TooltipOverlay for positioning.
 */
function setupTooltipArrow(def: DefHandle<TooltipArrowProps, TooltipArrowExposes>): void {
  def.anatomy.claim(TOOLTIP_FAMILY, { role: 'arrow' });
}

export const asTooltipArrow = defineAsHook<
  TooltipArrowProps,
  TooltipArrowExposes,
  TooltipArrowAsHookContract
>({
  name: 'as-tooltip-arrow',
  mode: 'once',
  setup: setupTooltipArrow,
});

const tooltipArrow = definePrototype({
  name: 'base-tooltip-arrow',
  setup(def) {
    setupTooltipArrow(def);
    def.feedback.style.use(tw('absolute h-2 w-2 rotate-45 bg-gray-900'));
  },
});

export default tooltipArrow;
