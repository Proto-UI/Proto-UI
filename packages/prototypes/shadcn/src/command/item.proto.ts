import { definePrototype, tw } from '@proto.ui/core';
import { asCommandItem, type CommandItemExposes } from '@proto.ui/prototypes-base/command';
import type { CommandItemProps } from './types';
import { setupCommandStyle } from './visual';
export default definePrototype<CommandItemProps, CommandItemExposes>({
  name: 'shadcn-command-item',
  setup(def) {
    const behavior = asCommandItem();
    const style = setupCommandStyle(def);
    def.rule({
      when: (w) => w.state(style).eq('new-york-v4'),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'flex min-w-0 cursor-default select-none items-center rounded-sm px-3 py-2 text-sm break-words'
          )
        ),
    });
    def.rule({
      when: (w) => w.state(style).eq('rhea'),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'relative flex min-w-0 cursor-default select-none items-center gap-2 min-h-7 rounded-[var(--pui-radius-xl)] px-2 py-1.5 text-sm break-words outline-none'
          )
        ),
    });
    def.rule({
      when: (w) => w.state(behavior.getState!('disabled')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-not-allowed')),
    });
    def.rule({
      when: (w) =>
        w.all(w.state(style).eq('new-york-v4'), w.state(behavior.getState!('active')!).eq(true)),
      intent: (i) => i.feedback.style.use(tw('bg-primary text-primary-foreground')),
    });
    def.rule({
      when: (w) =>
        w.all(w.state(style).eq('new-york-v4'), w.state(behavior.getState!('selected')!).eq(true)),
      intent: (i) => i.feedback.style.use(tw('font-semibold')),
    });
    def.rule({
      when: (w) =>
        w.all(w.state(style).eq('rhea'), w.state(behavior.getState!('active')!).eq(true)),
      intent: (i) => i.feedback.style.use(tw('bg-muted text-foreground')),
    });
  },
});
