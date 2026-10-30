import { definePrototype, tw } from '@proto.ui/core';
import {
  asTooltipContent,
  type TooltipContentProps,
  type TooltipContentExposes,
} from '@proto.ui/prototypes-base/tooltip';

export default definePrototype<TooltipContentProps, TooltipContentExposes>({
  name: 'liquid-glass-tooltip-content',
  setup(def) {
    const behavior = asTooltipContent();
    // Supplementary non-interactive text: ordinary opaque surface, no material
    // owner (liquid glass is reserved for functional/navigation surfaces).
    def.feedback.style.use(
      tw(
        'z-50 max-w-xs rounded-md border border-border bg-secondary px-3 py-1.5 text-xs text-secondary-foreground shadow-md'
      )
    );
    behavior.asTransition.configure({ enterDuration: 0, leaveDuration: 0 });
  },
});
