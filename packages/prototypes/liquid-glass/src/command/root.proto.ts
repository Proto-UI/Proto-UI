import { definePrototype, tw } from '@proto.ui/core';
import {
  asCommandRoot,
  type CommandRootProps,
  type CommandRootExposes,
} from '@proto.ui/prototypes-base/command';
export default definePrototype<CommandRootProps, CommandRootExposes>({
  name: 'liquid-glass-command-root',
  modules: asCommandRoot.modules,
  setup(def) {
    const behavior = asCommandRoot();
    def.feedback.style.use(
      tw('relative flex h-full min-h-0 min-w-0 w-full flex-col gap-2 font-sans text-foreground')
    );
    return behavior.render;
  },
});
