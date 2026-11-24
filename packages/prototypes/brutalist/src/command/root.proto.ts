import { definePrototype, tw } from '@proto.ui/core';
import {
  asCommandRoot,
  type CommandRootProps,
  type CommandRootExposes,
} from '@proto.ui/prototypes-base/command';
export default definePrototype<CommandRootProps, CommandRootExposes>({
  name: 'brutalist-command-root',
  modules: asCommandRoot.modules,
  setup(def) {
    const behavior = asCommandRoot();
    def.feedback.style.use(
      tw(
        'flex h-full min-h-0 min-w-0 w-full flex-col overflow-hidden rounded-base border-2 border-border bg-background text-foreground shadow-[4px_4px_0_0_#000] font-sans font-medium'
      )
    );
    return behavior.render;
  },
});
