import { definePrototype, tw } from '@proto.ui/core';
import { asCommandRoot, type CommandRootExposes } from '@proto.ui/prototypes-base/command';
import type { CommandRootProps } from './types';
import { setupCommandStyle } from './visual';
export default definePrototype<CommandRootProps, CommandRootExposes>({
  name: 'shadcn-command-root',
  setup(def) {
    const behavior = asCommandRoot();
    const style = setupCommandStyle(def, true);
    def.rule({
      when: (w) => w.state(style).eq('new-york-v4'),
      intent: (i) =>
        i.feedback.style.use(tw('relative flex min-w-0 w-full max-w-md flex-wrap gap-2')),
    });
    def.rule({
      when: (w) => w.state(style).eq('rhea'),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'flex flex-col min-w-0 w-full overflow-hidden rounded-[var(--pui-radius-3xl)] bg-popover text-popover-foreground p-1'
          )
        ),
    });
  },
});
