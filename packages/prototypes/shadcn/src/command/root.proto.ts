import { definePrototype, tw } from '@proto.ui/core';
import { asCommandRoot, type CommandRootExposes } from '@proto.ui/prototypes-base/command';
import type { CommandRootProps } from './types';
import { setupCommandPartPaint } from './visual';
export default definePrototype<CommandRootProps, CommandRootExposes>({
  name: 'shadcn-command-root',
  modules: asCommandRoot.modules,
  setup(def) {
    asCommandRoot();
    setupCommandPartPaint(def, 'root', true);
    def.feedback.style.use(
      tw('flex h-full w-full flex-col min-w-0 overflow-hidden bg-popover text-popover-foreground')
    );
  },
});
