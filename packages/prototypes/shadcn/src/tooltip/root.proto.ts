import { definePrototype } from '@proto.ui/core';
import { asTooltipRoot } from '@proto.ui/prototypes-base/tooltip';
import type { ShadcnTooltipRootExposes, ShadcnTooltipRootProps } from './types';
import { setupShadcnStyleScope } from '../style-scope';

const tooltipRoot = definePrototype<ShadcnTooltipRootProps, ShadcnTooltipRootExposes>({
  name: 'shadcn-tooltip-root',
  setup(def) {
    asTooltipRoot();
    setupShadcnStyleScope(def);
  },
});

export default tooltipRoot;
