import { definePrototype, tw } from '@proto.ui/core';
import { asTooltipTrigger } from '@proto.ui/prototypes-base/tooltip';
import type { ShadcnTooltipTriggerExposes, ShadcnTooltipTriggerProps } from './types';

const tooltipTrigger = definePrototype<ShadcnTooltipTriggerProps, ShadcnTooltipTriggerExposes>({
  name: 'shadcn-tooltip-trigger',
  setup(def) {
    const trigger = asTooltipTrigger();
    const state = trigger.stateHandles;
    if (!state) throw new Error('[shadcn-tooltip-trigger] missing Tooltip Trigger state handles.');
    const { hovered, focused, focusVisible } = state;
    def.feedback.style.use(tw('inline-flex cursor-pointer outline-none'));
    def.rule({
      when: (w) => w.state(hovered).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-80')),
    });
    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('ring-2 ring-ring ring-offset-2 ring-offset-background')),
    });
  },
});
export default tooltipTrigger;
