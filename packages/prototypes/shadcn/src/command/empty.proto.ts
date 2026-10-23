import { definePrototype, tw } from '@proto.ui/core';
import { asCommandEmpty, type CommandEmptyExposes } from '@proto.ui/prototypes-base/command';
import type { CommandEmptyProps } from './types';
import { setupCommandStyle } from './visual';
export default definePrototype<CommandEmptyProps, CommandEmptyExposes>({
  name: 'shadcn-command-empty',
  setup(def) {
    const behavior = asCommandEmpty();
    const style = setupCommandStyle(def);
    def.rule({
      when: (w) => w.state(style).eq('new-york-v4'),
      intent: (i) =>
        i.feedback.style.use(tw('px-3 py-6 text-center text-sm text-muted-foreground')),
    });
    def.rule({
      when: (w) => w.state(style).eq('rhea'),
      intent: (i) => i.feedback.style.use(tw('py-6 text-center text-sm')),
    });
  },
});
