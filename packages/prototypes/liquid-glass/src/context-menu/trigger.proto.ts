import { definePrototype, tw } from '@proto.ui/core';
import { COMMAND_BLOCKED, COMMAND_FOCUS_INSET } from '../interactive-surface';
import {
  asContextMenuTrigger,
  type ContextMenuTriggerProps,
  type ContextMenuTriggerExposes,
} from '@proto.ui/prototypes-base/context-menu';
export default definePrototype<ContextMenuTriggerProps, ContextMenuTriggerExposes>({
  name: 'liquid-glass-context-menu-trigger',
  setup(def) {
    const behavior = asContextMenuTrigger();
    def.feedback.style.use(
      tw(
        'rounded-xl border border-border inline-flex min-w-0 items-center justify-center px-3 py-2 text-sm font-medium text-foreground outline-none whitespace-normal'
      )
    );
    def.rule({
      when: (w) => w.state(behavior.getState!('disabled')!).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_BLOCKED)),
    });
    def.rule({
      when: (w) => w.state(behavior.getState!('focusVisible')!).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS_INSET)),
    });
    return behavior.render;
  },
});
