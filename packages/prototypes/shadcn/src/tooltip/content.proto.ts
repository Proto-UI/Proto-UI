import { definePrototype, tw } from '@proto.ui/core';
import { asTooltipContent } from '@proto.ui/prototypes-base/tooltip';
import type { ShadcnTooltipContentExposes, ShadcnTooltipContentProps } from './types';

const CONTENT_BASE_TOKENS = [
  'z-50',
  'overflow-hidden',
  'rounded-md',
  'border',
  'bg-popover',
  'px-3',
  'py-1.5',
  'text-xs',
  'text-popover-foreground',
  'shadow-md',
].join(' ');

const tooltipContent = definePrototype<ShadcnTooltipContentProps, ShadcnTooltipContentExposes>({
  name: 'shadcn-tooltip-content',
  setup(def) {
    asTooltipContent();
    def.feedback.style.use(tw(CONTENT_BASE_TOKENS));
  },
});
export default tooltipContent;
