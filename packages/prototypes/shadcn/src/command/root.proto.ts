import { definePrototype, tw } from '@proto.ui/core';
import { asCommandRoot, type CommandRootExposes } from '@proto.ui/prototypes-base/command';
import type { CommandRootProps } from './types';
import { COMMAND_INPUT_PAINT, setupCommandPartPaint } from './visual';
export default definePrototype<CommandRootProps, CommandRootExposes>({
  name: 'shadcn-command-root',
  modules: asCommandRoot.modules,
  setup(def) {
    asCommandRoot();
    def.context.provide(COMMAND_INPUT_PAINT, { command: false });
    setupCommandPartPaint(def, 'root', true);
    def.feedback.style.use(
      tw('flex h-full min-h-0 w-full flex-col min-w-0 overflow-hidden text-popover-foreground')
    );
    def.rule({
      when: (w) => w.prop('presentation').eq('default'),
      intent: (i) => i.feedback.style.use(tw('bg-popover')),
    });
  },
});
