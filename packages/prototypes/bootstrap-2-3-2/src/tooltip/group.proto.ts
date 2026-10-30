import { definePrototype, tw } from '@proto.ui/core';
import {
  asTooltipGroup,
  type TooltipGroupProps,
  type TooltipGroupExposes,
} from '@proto.ui/prototypes-base/tooltip';

// Semantic-only warm-delay owner: no upstream visual surface, so the sole paint is the
// shared grouping layout. Group cold/warm delay and skip-delay stay on the Base hook.
export default definePrototype<TooltipGroupProps, TooltipGroupExposes>({
  name: 'bootstrap-2-3-2-tooltip-group',
  setup(def) {
    asTooltipGroup();
    def.feedback.style.use(tw('inline-flex'));
    return (renderer) => renderer.r.slot();
  },
});
