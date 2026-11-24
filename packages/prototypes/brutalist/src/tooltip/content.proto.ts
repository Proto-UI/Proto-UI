import { definePrototype, tw } from '@proto.ui/core';
import { asTooltipContent } from '@proto.ui/prototypes-base/tooltip';
import type { BrutalistTooltipContentExposes, BrutalistTooltipContentProps } from './types';

export const BrutalistTooltipContent = definePrototype<
  BrutalistTooltipContentProps,
  BrutalistTooltipContentExposes
>({
  name: 'brutalist-tooltip-content',
  setup(def) {
    const behavior = asTooltipContent();
    const { open } = behavior.stateHandles;
    behavior.asTransition.configure({ enterDuration: 150, leaveDuration: 100 });
    def.feedback.style.use(
      tw(
        'z-50 inline-flex w-fit max-w-80 items-center gap-1.5 rounded-base border-2 border-foreground bg-secondary-background px-3 py-1.5 font-sans font-medium text-sm text-foreground text-balance'
      )
    );
    def.rule({
      when: (w) => w.state(open).eq(true),
      intent: (i) => i.feedback.style.use(tw('animate-in fade-in-0 zoom-in-95 duration-150')),
    });
    def.rule({
      when: (w) => w.state(open).eq(false),
      intent: (i) => i.feedback.style.use(tw('animate-out fade-out-0 zoom-out-95 duration-100')),
    });
    def.rule({
      when: (w) => w.meta('preference.reducedMotion').eq('reduce'),
      intent: (i) => i.feedback.style.use(tw('animate-none transition-none')),
    });
    return (renderer) => [renderer.r.slot()];
  },
});
