import { definePrototype, tw } from '@proto.ui/core';
import { asCommandContent, type CommandContentExposes } from '@proto.ui/prototypes-base/command';
import type { CommandContentProps } from './types';
import { setupCommandPartPaint } from './visual';
export default definePrototype<CommandContentProps, CommandContentExposes>({
  name: 'shadcn-command-content',
  modules: asCommandContent.modules,
  setup(def) {
    asCommandContent();
    setupCommandPartPaint(def, 'list');
    def.feedback.style.use(tw('min-w-0 w-full overflow-x-hidden overflow-y-auto'));
  },
});
