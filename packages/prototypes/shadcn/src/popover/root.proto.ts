import { definePrototype, tw } from '@proto.ui/core';
import { asPopoverRoot, type PopoverRootExposes } from '@proto.ui/prototypes-base/popover';
import type { PopoverRootProps } from './types';
import { setupShadcnStyleScope } from '../style-scope';

export default definePrototype<PopoverRootProps, PopoverRootExposes>({
  name: 'shadcn-popover-root',
  setup(def) {
    const behavior = asPopoverRoot();
    setupShadcnStyleScope(def);
    def.feedback.style.use(tw('relative inline-flex min-w-0'));
  },
});
