import { definePrototype, tw } from '@proto.ui/core';
import { asHoverCardTrigger } from '@proto.ui/prototypes-base/hover-card';
import type { ShadcnHoverCardTriggerExposes, ShadcnHoverCardTriggerProps } from './types';
import { setupOverlayStyle } from '../dialog/style';

const TRIGGER_BASE_TOKENS =
  'inline-flex cursor-pointer items-center text-sm font-medium underline-offset-4 outline-none';

const hoverCardTrigger = definePrototype<
  ShadcnHoverCardTriggerProps,
  ShadcnHoverCardTriggerExposes
>({
  name: 'shadcn-hover-card-trigger',
  setup(def) {
    // P-SHADCN-HOVER-CARD-TRIGGER-BASE-INHERITANCE,
    // P-SHADCN-HOVER-CARD-TRIGGER-CURRENT-BASE-DEVIATIONS
    const hoverCard = asHoverCardTrigger();
    const state = hoverCard.stateHandles;
    if (!state) {
      throw new Error('[shadcn-hover-card-trigger] missing Hover Card Trigger state handles.');
    }
    const { disabled, hovered, focusVisible } = state;
    const style = setupOverlayStyle(def);

    // Preserve the existing New York Proto link appearance; modern wrappers
    // prescribe no paint and continue to own preview intent, not activation.
    def.rule({
      when: (w) => w.state(style).eq('new-york-v4'),
      intent: (i) => i.feedback.style.use(tw(TRIGGER_BASE_TOKENS)),
    });

    // P-SHADCN-HOVER-CARD-TRIGGER-STATE-DRIVEN-STYLES
    def.rule({
      when: (w) => w.all(w.state(style).eq('new-york-v4'), w.state(hovered).eq(true)),
      intent: (i) => i.feedback.style.use(tw('underline')),
    });

    def.rule({
      when: (w) => w.all(w.state(style).eq('new-york-v4'), w.state(focusVisible).eq(true)),
      intent: (i) => i.feedback.style.use(tw('ring-2 ring-ring ring-offset-2')),
    });

    def.rule({
      when: (w) => w.all(w.state(style).eq('new-york-v4'), w.state(disabled).eq(true)),
      intent: (i) => i.feedback.style.use(tw('pointer-events-none opacity-50')),
    });
  },
});

/** P-SHADCN-HOVER-CARD-TRIGGER-DIRECT-ENTRY; parity is bounded by P-SHADCN-HOVER-CARD-TRIGGER-COMPATIBILITY-SUBSET. */

export default hoverCardTrigger;
