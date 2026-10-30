import { definePrototype, tw } from '@proto.ui/core';
import {
  asTooltipTrigger,
  type TooltipTriggerProps,
  type TooltipTriggerExposes,
} from '@proto.ui/prototypes-base/tooltip';

// Upstream tooltips attach to unstyled author elements, so the trigger stays chromeless
// with only interaction feedback (twbs/bootstrap@b4c4072 less/tooltip.less). The
// describedBy relation and hover/focus request ownership remain entirely Base-owned.
export default definePrototype<TooltipTriggerProps, TooltipTriggerExposes>({
  name: 'bootstrap-2-3-2-tooltip-trigger',
  setup(def) {
    const behavior = asTooltipTrigger();
    const state = behavior.getState!;
    def.feedback.style.use(tw('inline-flex items-center cursor-pointer outline-none'));
    def.rule({
      when: (w) => w.state(state('focusVisible')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('ring-2 ring-ring ring-offset-2')),
    });
    def.rule({
      when: (w) => w.state(state('disabled')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-not-allowed')),
    });
  },
});
