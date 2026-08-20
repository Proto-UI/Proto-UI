import { definePrototype, tw } from '@proto.ui/core';
import { asHoverCardTrigger } from '@proto.ui/prototypes-base/hover-card';
import type { BrutalistHoverCardTriggerExposes, BrutalistHoverCardTriggerProps } from './types';

const TRIGGER_BASE_TOKENS = [
  'inline-flex',
  'rounded-none',
  'border-2',
  'border-black',
  'bg-main',
  'px-3',
  'py-1.5',
  'font-bold',
  'uppercase',
  'text-main-foreground',
  'shadow-[3px_3px_0_0_#000]',
  'outline-none',
].join(' ');

const hoverCardTrigger = definePrototype<
  BrutalistHoverCardTriggerProps,
  BrutalistHoverCardTriggerExposes
>({
  name: 'brutalist-hover-card-trigger',
  setup(def) {
    // P-BRUTALIST-HOVER-CARD-TRIGGER-BASE-INHERITANCE
    const hoverCard = asHoverCardTrigger();
    const state = hoverCard.stateHandles;
    if (!state) {
      throw new Error('[brutalist-hover-card-trigger] missing Hover Card Trigger state handles.');
    }
    const { disabled, hovered, focusVisible } = state;

    // P-BRUTALIST-HOVER-CARD-TRIGGER-PAIR-INVARIANT,
    // P-BRUTALIST-HOVER-CARD-TRIGGER-VISUAL-GRAMMAR
    def.feedback.style.use(tw(TRIGGER_BASE_TOKENS));

    // P-BRUTALIST-HOVER-CARD-TRIGGER-INTERACTION
    def.rule({
      when: (w) => w.state(hovered).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('-translate-x-px -translate-y-px shadow-[4px_4px_0_0_#000]')),
    });

    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw('ring-2 ring-ring ring-offset-2')),
    });

    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('pointer-events-none opacity-50')),
    });
  },
});

/** P-BRUTALIST-HOVER-CARD-TRIGGER-ENTRY */

export default hoverCardTrigger;
