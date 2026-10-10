import { definePrototype, tw } from '@proto.ui/core';
import {
  asCommandContent,
  type CommandContentProps,
  type CommandContentExposes,
} from '@proto.ui/prototypes-base/command';
export default definePrototype<CommandContentProps, CommandContentExposes>({
  name: 'bootstrap-2-3-2-command-content',
  setup(def) {
    const behavior = asCommandContent();
    def.feedback.style.use(
      tw(
        'rounded border border-border bg-background text-foreground shadow-md min-w-0 w-full max-h-80 overflow-y-auto p-1'
      )
    );
  },
});
