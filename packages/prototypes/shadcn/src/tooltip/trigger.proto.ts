import { definePrototype, tw } from '@proto.ui/core';
import { asTooltipTrigger } from '@proto.ui/prototypes-base/tooltip';
import type { ShadcnTooltipTriggerExposes, ShadcnTooltipTriggerProps } from './types';

const tooltipTrigger = definePrototype<ShadcnTooltipTriggerProps, ShadcnTooltipTriggerExposes>({
  name: 'shadcn-tooltip-trigger',
  setup(def) {
    const state = asTooltipTrigger().stateHandles;
    if (!state) {
      throw new Error(
        '[shadcn-tooltip-trigger] asTooltipTrigger must project Tooltip Trigger state handles.'
      );
    }
    const { disabled, hovered, focusVisible } = state;
    const pressed = def.state.fromInteraction('pressed');

    def.feedback.style.use(tw('inline-flex cursor-pointer outline-none'));
    def.rule({
      when: (when) => when.state(hovered).eq(true),
      intent: (intent) => intent.feedback.style.use(tw('opacity-70')),
    });
    def.rule({
      when: (when) => when.state(focusVisible).eq(true),
      intent: (intent) =>
        intent.feedback.style.use(tw('ring-2 ring-ring ring-offset-2 ring-offset-background')),
    });
    def.rule({
      when: (when) => when.all(when.state(pressed).eq(true), when.state(disabled).eq(false)),
      intent: (intent) => intent.feedback.style.use(tw('scale-[0.98]')),
    });
  },
});

export default tooltipTrigger;
