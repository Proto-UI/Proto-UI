import { definePrototype } from '@proto.ui/core';
import { asTooltipTrigger } from '@proto.ui/prototypes-base/tooltip';
import type { BrutalistTooltipTriggerExposes, BrutalistTooltipTriggerProps } from './types';
export const BrutalistTooltipTrigger = definePrototype<
  BrutalistTooltipTriggerProps,
  BrutalistTooltipTriggerExposes
>({
  name: 'brutalist-tooltip-trigger',
  setup() {
    asTooltipTrigger();
  },
});
