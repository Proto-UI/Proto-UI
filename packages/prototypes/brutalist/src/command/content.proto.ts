import { definePrototype, tw } from '@proto.ui/core';
import {
  asCommandContent,
  type CommandContentProps,
  type CommandContentExposes,
} from '@proto.ui/prototypes-base/command';
export default definePrototype<CommandContentProps, CommandContentExposes>({
  name: 'brutalist-command-content',
  setup(def) {
    const behavior = asCommandContent();
    def.feedback.style.use(
      tw(
        'rounded-none border-2 border-foreground bg-background text-foreground shadow-[3px_3px_0_0_var(--pui-foreground)] min-w-0 w-full max-h-80 overflow-y-auto p-1'
      )
    );
  },
});
