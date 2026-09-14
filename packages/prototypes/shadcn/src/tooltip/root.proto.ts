import { definePrototype } from '@proto.ui/core';
import { asTooltipRoot } from '@proto.ui/prototypes-base/tooltip';
import type { ShadcnTooltipRootExposes, ShadcnTooltipRootProps } from './types';

const tooltipRoot = definePrototype<ShadcnTooltipRootProps, ShadcnTooltipRootExposes>({
  name: 'shadcn-tooltip-root',
  setup() {
    asTooltipRoot();
  },
});

export default tooltipRoot;
