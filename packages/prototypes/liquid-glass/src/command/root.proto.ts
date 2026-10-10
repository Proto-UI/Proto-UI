import { definePrototype, tw } from '@proto.ui/core';
import {
  asCommandRoot,
  type CommandRootProps,
  type CommandRootExposes,
} from '@proto.ui/prototypes-base/command';
export default definePrototype<CommandRootProps, CommandRootExposes>({
  name: 'liquid-glass-command-root',
  setup(def) {
    const behavior = asCommandRoot();
    def.feedback.style.use(tw('relative flex min-w-0 w-full max-w-md flex-wrap gap-2'));
  },
});
