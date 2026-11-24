import { definePrototype, tw } from '@proto.ui/core';
import {
  asCommandContent,
  type CommandContentProps,
  type CommandContentExposes,
} from '@proto.ui/prototypes-base/command';
export default definePrototype<CommandContentProps, CommandContentExposes>({
  name: 'liquid-glass-command-content',
  modules: asCommandContent.modules,
  setup(def) {
    const behavior = asCommandContent();
    // Base Command is an inline list, not a floating popup. Its content stays
    // ordinary even when a consumer places the command inside a glass dialog,
    // avoiding glass-on-glass stacking while keeping concentric outer radii (rounded-2xl + p-1).
    def.feedback.style.use(
      tw(
        'min-h-0 min-w-0 w-full max-h-80 overflow-x-hidden overflow-y-auto rounded-2xl border border-border bg-secondary p-1 text-secondary-foreground shadow-md'
      )
    );
    def.rule({
      when: (w) => w.meta('preference.reducedTransparency').eq('reduce'),
      intent: (i) => i.feedback.style.use(tw('shadow-none')),
    });
    return behavior.render;
  },
});
