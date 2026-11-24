import { definePrototype, tw } from '@proto.ui/core';
import { asHoverCardTrigger } from '@proto.ui/prototypes-base/hover-card';
import {
  BRUTALIST_DISABLED_TOKENS,
  BRUTALIST_FOCUS_TOKENS,
  BRUTALIST_MOTION_HIT_TOKENS,
} from '../style';
import type { BrutalistHoverCardTriggerExposes, BrutalistHoverCardTriggerProps } from './types';

const TRIGGER_BASE_TOKENS = [
  'inline-flex',
  'cursor-pointer',
  'items-center',
  'rounded-base',
  'border-2',
  'border-black',
  'bg-main',
  'px-3',
  'py-1.5',
  'font-sans',
  'text-sm',
  'leading-5',
  'font-medium',
  'text-main-foreground',
  'shadow-[4px_4px_0_0_#000]',
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
    // Retain the original pointer hit envelope while settled into the 4px hard shadow.
    def.rule({
      when: (w) => w.state(hovered).eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw(`translate-x-1 translate-y-1 shadow-none ${BRUTALIST_MOTION_HIT_TOKENS}`)
        ),
    });

    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw(BRUTALIST_FOCUS_TOKENS)),
    });

    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw(BRUTALIST_DISABLED_TOKENS)),
    });
  },
});

/** P-BRUTALIST-HOVER-CARD-TRIGGER-ENTRY */

export default hoverCardTrigger;
