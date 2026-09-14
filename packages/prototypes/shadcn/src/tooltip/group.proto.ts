import { definePrototype, tw } from '@proto.ui/core';
import { asTooltipGroup } from '@proto.ui/prototypes-base/tooltip';
import type { ShadcnTooltipGroupExposes, ShadcnTooltipGroupProps } from './types';

const tooltipGroup = definePrototype<ShadcnTooltipGroupProps, ShadcnTooltipGroupExposes>({
  name: 'shadcn-tooltip-group',
  setup(def) {
    asTooltipGroup();
    def.feedback.style.use(tw('inline-flex'));
  },
});

export default tooltipGroup;
