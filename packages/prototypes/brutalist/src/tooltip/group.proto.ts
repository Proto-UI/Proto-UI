import { definePrototype } from '@proto.ui/core';
import { asTooltipGroup } from '@proto.ui/prototypes-base/tooltip';
import type { BrutalistTooltipGroupExposes, BrutalistTooltipGroupProps } from './types';

/**
 * Transparent design-language entry: Base owns timing, context, and same-domain
 * intent aggregation. Brutalist owns only the cataloged draft package identity and adds
 * no props, state, events, accessibility, or visual surface.
 */
export const BrutalistTooltipGroup = definePrototype<
  BrutalistTooltipGroupProps,
  BrutalistTooltipGroupExposes
>({
  name: 'brutalist-tooltip-group',
  setup() {
    // P-BRUTALIST-TOOLTIP-GROUP-BASE-INHERITANCE
    // P-BRUTALIST-TOOLTIP-GROUP-ZERO-DELTA
    asTooltipGroup();
  },
});
