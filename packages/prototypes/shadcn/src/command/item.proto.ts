import { definePrototype, tw } from '@proto.ui/core';
import { asCommandItem, type CommandItemExposes } from '@proto.ui/prototypes-base/command';
import type { CommandItemProps } from './types';
import { setupCommandPartPaint } from './visual';
export default definePrototype<CommandItemProps, CommandItemExposes>({
  name: 'shadcn-command-item',
  modules: asCommandItem.modules,
  setup(def) {
    const behavior = asCommandItem();
    const style = setupCommandPartPaint(def, 'item');
    def.feedback.style.use(
      tw('relative flex min-w-0 cursor-default select-none items-center break-words outline-none')
    );
    def.rule({
      when: (w) => w.state(behavior.getState!('disabled')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('pointer-events-none opacity-50')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq('new-york-v4'),
          w.state(behavior.getState!('active')!).eq(true),
          w.prop('presentation').eq('default')
        ),
      intent: (i) => i.feedback.style.use(tw('bg-accent text-accent-foreground')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.not(w.state(style).eq('new-york-v4')),
          w.prop('presentation').eq('default'),
          w.state(behavior.getState!('active')!).eq(true)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-muted text-foreground')),
    });
    def.rule({
      when: (w) =>
        w.all(w.prop('presentation').eq('menu'), w.state(behavior.getState!('active')!).eq(true)),
      intent: (i) => i.feedback.style.use(tw('border-input bg-input/50 text-foreground')),
    });
  },
});
