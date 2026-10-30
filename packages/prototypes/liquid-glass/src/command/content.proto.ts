import { definePrototype, tw } from '@proto.ui/core';
import {
  asCommandContent,
  type CommandContentProps,
  type CommandContentExposes,
} from '@proto.ui/prototypes-base/command';
export default definePrototype<CommandContentProps, CommandContentExposes>({
  name: 'liquid-glass-command-content',
  setup(def) {
    const behavior = asCommandContent();
    // Base Command is an inline list, not a floating popup. Its content stays
    // ordinary even when a consumer places the command inside a glass dialog.
    def.feedback.style.use(
      tw(
        'rounded-2xl border border-border bg-secondary text-secondary-foreground shadow-md min-w-0 w-full max-h-80 overflow-y-auto p-1'
      )
    );
    return behavior.render;
  },
});
