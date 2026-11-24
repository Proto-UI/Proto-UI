import { definePrototype, tw } from '@proto.ui/core';
import {
  COMMAND_BLOCKED,
  COMMAND_FOCUS_INSET,
  COMMAND_HOVER,
  COMMAND_PRESS,
} from '../interactive-surface';
import {
  asContextMenuTrigger,
  type ContextMenuTriggerProps,
  type ContextMenuTriggerExposes,
} from '@proto.ui/prototypes-base/context-menu';

export default definePrototype<ContextMenuTriggerProps, ContextMenuTriggerExposes>({
  name: 'liquid-glass-context-menu-trigger',
  modules: asContextMenuTrigger.modules,
  setup(def) {
    const behavior = asContextMenuTrigger();
    const disabled = behavior.getState!('disabled')!;
    const hovered = behavior.getState!('hovered')!;
    const pressed = behavior.getState!('pressed')!;
    const focusVisible = behavior.getState!('focusVisible')!;

    // Trigger stays an ordinary non-glass content surface so the floating menu never stacks glass-on-glass.
    def.feedback.style.use(
      tw(
        'rounded-xl border border-border inline-flex min-w-0 items-center justify-center px-3 py-2 text-sm font-medium text-foreground outline-none whitespace-normal select-none'
      )
    );
    def.rule({
      when: (w) =>
        w.all(
          w.state(hovered).eq(true),
          w.state(pressed).eq(false),
          w.state(disabled).eq(false),
          w.state(focusVisible).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw(COMMAND_HOVER)),
    });
    def.rule({
      when: (w) => w.all(w.state(pressed).eq(true), w.state(disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw(COMMAND_PRESS)),
    });
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_BLOCKED)),
    });
    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS_INSET)),
    });
    return behavior.render;
  },
});
