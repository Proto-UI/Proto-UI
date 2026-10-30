import { definePrototype, tw } from '@proto.ui/core';
import {
  asCommandRoot,
  type CommandRootProps,
  type CommandRootExposes,
} from '@proto.ui/prototypes-base/command';
export default definePrototype<CommandRootProps, CommandRootExposes>({
  name: 'brutalist-command-root',
  setup(def) {
    const behavior = asCommandRoot();
    def.feedback.style.use(
      tw(
        'flex h-full min-h-0 min-w-0 w-full flex-col overflow-hidden rounded-none border-2 border-border bg-background text-foreground font-sans font-medium'
      )
    );
  },
});
