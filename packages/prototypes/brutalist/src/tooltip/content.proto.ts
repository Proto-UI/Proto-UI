import { definePrototype, tw } from '@proto.ui/core';
import { asTooltipContent } from '@proto.ui/prototypes-base/tooltip';
import type { BrutalistTooltipContentExposes, BrutalistTooltipContentProps } from './types';
export const BrutalistTooltipContent = definePrototype<
  BrutalistTooltipContentProps,
  BrutalistTooltipContentExposes
>({
  name: 'brutalist-tooltip-content',
  setup(def) {
    asTooltipContent();
    def.feedback.style.use(
      tw(
        'z-50 rounded-base border-2 border-black bg-secondary-background px-3 py-1.5 font-sans font-medium text-sm text-foreground'
      )
    );
    return (renderer) => [renderer.r.slot()];
  },
});
