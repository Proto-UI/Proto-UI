import { definePrototype, tw } from '@proto.ui/core';
import {
  asTooltipTrigger,
  type TooltipTriggerProps,
  type TooltipTriggerExposes,
} from '@proto.ui/prototypes-base/tooltip';

// Upstream tooltips attach to unstyled author elements, so the trigger stays chromeless
// with classic Bootstrap 2.3.2 keyboard focus outline and disabled affordance
// (twbs/bootstrap@b4c4072 less/tooltip.less, less/mixins.less tab-focus).
export default definePrototype<TooltipTriggerProps, TooltipTriggerExposes>({
  name: 'bootstrap-2-3-2-tooltip-trigger',
  setup(def) {
    const behavior = asTooltipTrigger();
    const state = behavior.getState!;
    def.feedback.style.use(tw('inline-flex items-center cursor-pointer outline-none'));
    def.rule({
      when: (w) => w.state(state('focusVisible')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('outline-2 outline-offset-2 outline-ring')),
    });
    def.rule({
      when: (w) => w.state(state('disabled')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-not-allowed')),
    });
  },
});
