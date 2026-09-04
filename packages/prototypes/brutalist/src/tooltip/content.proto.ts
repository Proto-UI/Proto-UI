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
        'z-50 rounded-none border-2 border-foreground bg-foreground px-3 py-2 font-mono text-xs font-bold uppercase text-background shadow-[4px_4px_0_0_var(--pui-foreground)]'
      )
    );
    return (renderer) => [renderer.r.slot()];
  },
});
