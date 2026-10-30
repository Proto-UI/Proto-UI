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
            'min-h-0 min-w-0 w-full max-h-[18.75rem] scroll-py-1 overflow-x-hidden overflow-y-auto'
          )
        ),
    });
    def.rule({
      when: (w) => w.state(style).eq('rhea'),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'min-h-0 min-w-0 w-full max-h-72 scroll-py-1 overflow-x-hidden overflow-y-auto outline-none'
          )
        ),
    });
  },
});
