import { definePrototype, tw } from '@proto.ui/core';
import { asTooltipContent } from '@proto.ui/prototypes-base/tooltip';
import type { ShadcnTooltipContentExposes, ShadcnTooltipContentProps } from './types';

const CONTENT_SURFACE_TOKENS = [
  'z-50',
  'inline-flex',
  'w-fit',
  'max-w-80',
  'items-center',
  'gap-1.5',
  'rounded-md',
  'bg-foreground',
  'px-3',
  'py-1.5',
  'text-xs',
  'text-background',
].join(' ');

const tooltipContent = definePrototype<ShadcnTooltipContentProps, ShadcnTooltipContentExposes>({
  name: 'shadcn-tooltip-content',
  setup(def) {
    asTooltipContent();
    def.feedback.style.use(tw(CONTENT_SURFACE_TOKENS));
    return (renderer) => [renderer.r.slot()];
  },
});

export default tooltipContent;
