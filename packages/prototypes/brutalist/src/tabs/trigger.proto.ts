import { definePrototype, tw } from '@proto.ui/core';
import { asTabsTrigger } from '@proto.ui/prototypes-base/tabs';
import {
  BRUTALIST_DISABLED_TOKENS,
  BRUTALIST_FOCUS_TOKENS,
  BRUTALIST_PRESS_TOKENS,
} from '../style';
import type { BrutalistTabsTriggerExposes, BrutalistTabsTriggerProps } from './types';

// P-BRUTALIST-TABS-TRIGGER-VISUAL-GRAMMAR — resting label: rounded-none, border-2
// border-transparent (transparent at rest, black when selected/hovered), bold-uppercase,
// text-foreground resting fill, no fill until selected/hover.
const BASE_TOKENS = [
  'inline-flex',
  'items-center',
  'justify-center',
  'whitespace-nowrap',
  'rounded-none',
  'border-2',
  'border-transparent',
  'px-3',
  'py-1.5',
  'text-sm',
  'font-bold',
  'uppercase',
  'outline-none',
  'text-foreground',
  'select-none',
].join(' ');
const tabsTrigger = definePrototype<BrutalistTabsTriggerProps, BrutalistTabsTriggerExposes>({
  // P-BRUTALIST-TABS-TRIGGER-ENTRY
  name: 'brutalist-tabs-trigger',
  setup(def) {
    // P-BRUTALIST-TABS-TRIGGER-BASE-INHERITANCE
    const triggerState = asTabsTrigger().stateHandles;
    if (!triggerState) {
      throw new Error(
        '[brutalist-tabs-trigger] asTabsTrigger must project Tabs trigger state handles.'
      );
    }
    const { disabled, hovered, focusVisible, pressed, selected } = triggerState;

    def.feedback.style.use(tw(BASE_TOKENS));

    // P-BRUTALIST-TABS-TRIGGER-SELECTED-PAIR-INVARIANT — selected keeps its
    // semantic color and border while press independently owns elevation.
    def.rule({
      when: (w) => w.state(selected).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-main text-main-foreground border-black')),
    });
    def.rule({
      when: (w) => w.all(w.state(selected).eq(true), w.state(pressed).eq(false)),
      intent: (i) => i.feedback.style.use(tw('shadow-[3px_3px_0_0_#000]')),
    });
    // P-BRUTALIST-TABS-TRIGGER-INTERACTION — hover lift (non-selected only)
    def.rule({
      when: (w) =>
        w.all(w.state(hovered).eq(true), w.state(selected).eq(false), w.state(pressed).eq(false)),
      intent: (i) =>
        i.feedback.style.use(
          tw('bg-background border-black -translate-x-px -translate-y-px shadow-[4px_4px_0_0_#000]')
        ),
    });
    // P-BRUTALIST-TABS-TRIGGER-INTERACTION — focus-visible
    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw(BRUTALIST_FOCUS_TOKENS)),
    });
    // P-BRUTALIST-TABS-TRIGGER-INTERACTION — press
    def.rule({
      when: (w) => w.state(pressed).eq(true),
      intent: (i) => i.feedback.style.use(tw(BRUTALIST_PRESS_TOKENS)),
    });
    // P-BRUTALIST-TABS-TRIGGER-INTERACTION — disabled
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw(BRUTALIST_DISABLED_TOKENS)),
    });
  },
});

export default tabsTrigger;
