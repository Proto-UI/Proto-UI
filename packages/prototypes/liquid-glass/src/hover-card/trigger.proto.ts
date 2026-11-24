import { definePrototype, tw } from '@proto.ui/core';
import {
  asHoverCardTrigger,
  type HoverCardTriggerProps,
  type HoverCardTriggerExposes,
} from '@proto.ui/prototypes-base/hover-card';
import { COMMAND_BLOCKED, COMMAND_FOCUS } from '../interactive-surface';

export default definePrototype<HoverCardTriggerProps, HoverCardTriggerExposes>({
  name: 'liquid-glass-hover-card-trigger',
  setup(def) {
    const behavior = asHoverCardTrigger();
    // Hover-card triggers are navigational/link-like owners, never stacked glass surfaces;
    // keep a clear link affordance, pointer cursor, and forced-colors-safe focus ring.
    def.feedback.style.use(
      tw(
        'inline-flex items-center rounded-md text-sm font-medium text-primary underline-offset-4 cursor-pointer outline-none'
      )
    );
    const state = behavior.getState!;
    def.rule({
      when: (w) => w.all(w.state(state('hovered')!).eq(true), w.state(state('disabled')!).eq(false)),
      intent: (i) => i.feedback.style.use(tw('underline')),
    });
    def.rule({
      when: (w) => w.state(state('focusVisible')!).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS)),
    });
    def.rule({
      when: (w) => w.state(state('disabled')!).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw(`${COMMAND_BLOCKED} text-muted-foreground no-underline`)),
    });
  },
});
