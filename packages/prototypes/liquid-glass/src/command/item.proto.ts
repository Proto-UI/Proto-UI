import { definePrototype, tw } from '@proto.ui/core';
import {
  asCommandItem,
  type CommandItemProps,
  type CommandItemExposes,
} from '@proto.ui/prototypes-base/command';
import { COMMAND_DISABLED } from '../interactive-surface';
export default definePrototype<CommandItemProps, CommandItemExposes>({
  name: 'liquid-glass-command-item',
  modules: asCommandItem.modules,
  setup(def) {
    const behavior = asCommandItem();
    // Concentric inner corner radius (rounded-xl = 12px inside rounded-2xl 16px - p-1 4px).
    def.feedback.style.use(
      tw(
        'relative flex min-w-0 cursor-default select-none items-center gap-2 rounded-xl px-3 py-2 font-sans text-sm outline-none break-words'
      )
    );
    def.rule({
      when: (w) => w.meta('preference.reducedMotion').eq('no-preference'),
      intent: (i) => i.feedback.style.use(tw('transition-colors duration-150')),
    });
    def.rule({
      when: (w) => w.state(behavior.getState!('disabled')!).eq(true),
      intent: (i) => i.feedback.style.use(tw(`${COMMAND_DISABLED} text-muted-foreground`)),
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
      intent: (i) => i.feedback.style.use(tw('font-semibold')),
    });
    return behavior.render;
  },
});
