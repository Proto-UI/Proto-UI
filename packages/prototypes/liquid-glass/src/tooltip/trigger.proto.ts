import { definePrototype, tw } from '@proto.ui/core';
import {
  asTooltipTrigger,
  type TooltipTriggerProps,
  type TooltipTriggerExposes,
} from '@proto.ui/prototypes-base/tooltip';

export default definePrototype<TooltipTriggerProps, TooltipTriggerExposes>({
  name: 'liquid-glass-tooltip-trigger',
  setup(def) {
    const behavior = asTooltipTrigger();
    // The described control keeps its own presentation; the projection only
    // guarantees an outline-safe host and a visible keyboard focus ring.
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
