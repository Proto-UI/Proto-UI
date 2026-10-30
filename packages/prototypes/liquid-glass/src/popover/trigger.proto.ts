import { definePrototype, tw } from '@proto.ui/core';
import { COMMAND_BLOCKED, COMMAND_FOCUS } from '../interactive-surface';
import {
  asPopoverTrigger,
  type PopoverTriggerProps,
  type PopoverTriggerExposes,
} from '@proto.ui/prototypes-base/popover';

export default definePrototype<PopoverTriggerProps, PopoverTriggerExposes>({
  name: 'liquid-glass-popover-trigger',
  setup(def) {
    const behavior = asPopoverTrigger();
    def.feedback.style.use(
      tw(
        'inline-flex items-center justify-center rounded-full border border-border bg-secondary px-4 py-2 text-sm text-secondary-foreground outline-none'
      )
    );
    const state = behavior.getState!;
    def.rule({
      when: (w) => w.state(state('focusVisible')!).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS)),
    });
    def.rule({
      when: (w) => w.state(state('disabled')!).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_BLOCKED)),
    });
    return behavior.render;
  },
});
