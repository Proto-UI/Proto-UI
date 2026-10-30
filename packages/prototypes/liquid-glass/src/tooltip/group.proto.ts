import { definePrototype } from '@proto.ui/core';
import {
  asTooltipGroup,
  type TooltipGroupProps,
  type TooltipGroupExposes,
} from '@proto.ui/prototypes-base/tooltip';

// Semantic-only projection: Tooltip Group is an independent delay coordinator
// shared by sibling Tooltip Roots, not an anatomy part or painted surface.
export default definePrototype<TooltipGroupProps, TooltipGroupExposes>({
  name: 'liquid-glass-tooltip-group',
  setup(def) {
    asTooltipGroup();
  },
});
