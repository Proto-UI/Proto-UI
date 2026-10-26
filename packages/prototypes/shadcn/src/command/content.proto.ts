import { definePrototype, tw } from '@proto.ui/core';
import { asCommandContent, type CommandContentExposes } from '@proto.ui/prototypes-base/command';
import type { CommandContentProps } from './types';
import { setupCommandStyle } from './visual';
export default definePrototype<CommandContentProps, CommandContentExposes>({
  name: 'shadcn-command-content',
  setup(def) {
    const behavior = asCommandContent();
    const style = setupCommandStyle(def);
    def.rule({
      when: (w) => w.state(style).eq('new-york-v4'),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'rounded-lg border border-border bg-popover text-popover-foreground shadow-md min-w-0 w-full max-h-80 overflow-y-auto p-1'
          )
        ),
    });
    def.rule({
      when: (w) => w.state(style).eq('rhea'),
      intent: (i) =>
        i.feedback.style.use(
          tw('min-w-0 w-full max-h-72 overflow-x-hidden overflow-y-auto outline-none')
        ),
    });
  },
});
