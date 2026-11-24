import { definePrototype, tw } from '@proto.ui/core';
import {
  asCommandItem,
  type CommandItemProps,
  type CommandItemExposes,
} from '@proto.ui/prototypes-base/command';
export default definePrototype<CommandItemProps, CommandItemExposes>({
  name: 'brutalist-command-item',
  modules: asCommandItem.modules,
  setup(def) {
    const behavior = asCommandItem();
    def.feedback.style.use(
      tw(
        'relative flex min-w-0 cursor-default select-none items-center gap-2 rounded-base px-3 py-2 font-sans text-sm font-medium outline-none break-words'
      )
    );
    def.rule({
      when: (w) => w.state(behavior.getState!('disabled')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('pointer-events-none opacity-50 cursor-not-allowed')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(behavior.getState!('active')!).eq(true),
          w.state(behavior.getState!('disabled')!).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-primary text-primary-foreground')),
    });
    def.rule({
      when: (w) => w.state(behavior.getState!('selected')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('font-heading font-bold')),
    });
    return behavior.render;
  },
});
