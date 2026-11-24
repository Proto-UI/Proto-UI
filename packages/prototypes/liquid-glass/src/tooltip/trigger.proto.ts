import { definePrototype, tw } from '@proto.ui/core';
import {
  asTooltipTrigger,
  type TooltipTriggerProps,
  type TooltipTriggerExposes,
} from '@proto.ui/prototypes-base/tooltip';
import { COMMAND_BLOCKED, COMMAND_FOCUS } from '../interactive-surface';

export default definePrototype<TooltipTriggerProps, TooltipTriggerExposes>({
  name: 'liquid-glass-tooltip-trigger',
  setup(def) {
    const behavior = asTooltipTrigger();
    // The described control keeps its own presentation; the projection provides
    // a pill-aligned outline-safe host with forced-colors-safe keyboard focus.
    def.feedback.style.use(tw('inline-flex items-center rounded-full outline-none'));
    const state = behavior.getState!;
    def.rule({
      when: (w) => w.state(state('focusVisible')!).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS)),
    });
    def.rule({
      when: (w) => w.state(state('disabled')!).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_BLOCKED)),
    });
  },
});
