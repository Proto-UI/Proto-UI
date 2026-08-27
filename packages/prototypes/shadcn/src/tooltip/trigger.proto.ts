import { definePrototype, tw } from '@proto.ui/core';
import { asTooltipTrigger } from '@proto.ui/prototypes-base/tooltip';
import type { ShadcnTooltipTriggerExposes, ShadcnTooltipTriggerProps } from './types';

const tooltipTrigger = definePrototype<ShadcnTooltipTriggerProps, ShadcnTooltipTriggerExposes>({
  name: 'shadcn-tooltip-trigger',
  setup(def) {
    const trigger = asTooltipTrigger();
    const state = trigger.stateHandles;
    if (!state) throw new Error('[shadcn-tooltip-trigger] missing Tooltip Trigger state handles.');
    const { disabled, hovered, focusVisible } = state;
    // #383 deliberately leaves Base Tooltip unchanged. Until its protocol owns a
    // named pressed handle, consume the runtime-managed official interaction slot
    // so this visual projection does not create a competing activation owner.
    const pressed = def.state.fromInteraction('pressed');
    def.feedback.style.use(tw('inline-flex cursor-pointer outline-none'));
    def.rule({
      when: (w) => w.state(hovered).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-70')),
    });
    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('ring-2 ring-ring ring-offset-2 ring-offset-background')),
    });
    def.rule({
      when: (w) => w.all(w.state(pressed).eq(true), w.state(disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw('scale-[0.98]')),
    });
  },
});
export default tooltipTrigger;
