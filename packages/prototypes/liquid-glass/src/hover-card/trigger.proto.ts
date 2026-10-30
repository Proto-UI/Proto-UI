import { definePrototype, tw } from '@proto.ui/core';
import {
  asHoverCardTrigger,
  type HoverCardTriggerProps,
  type HoverCardTriggerExposes,
} from '@proto.ui/prototypes-base/hover-card';

export default definePrototype<HoverCardTriggerProps, HoverCardTriggerExposes>({
  name: 'liquid-glass-hover-card-trigger',
  setup(def) {
    const behavior = asHoverCardTrigger();
    // Hover-card triggers are navigational/link-like owners, not pill commands;
    // keep the presentation quiet while retaining a visible keyboard focus ring.
    def.feedback.style.use(tw('inline-flex items-center rounded-md outline-none'));
    const state = behavior.getState!;
    def.rule({
      when: (w) => w.state(state('focusVisible')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('ring-2 ring-ring ring-offset-2')),
    });
    def.rule({
      when: (w) => w.state(state('disabled')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('cursor-not-allowed')),
    });
  },
});
