import { definePrototype, tw } from '@proto.ui/core';
import { asCheckboxIndicator } from '@proto.ui/prototypes-base/checkbox';
import type { BrutalistCheckboxIndicatorExposes, BrutalistCheckboxIndicatorProps } from './types';

const INDICATOR_BASE_TOKENS = 'inline-flex items-center justify-center text-current';

const checkboxIndicator = definePrototype<
  BrutalistCheckboxIndicatorProps,
  BrutalistCheckboxIndicatorExposes
>({
  name: 'brutalist-checkbox-indicator',
  setup(def) {
    const indicator = asCheckboxIndicator();
    const state = indicator.stateHandles;
    if (!state) {
      throw new Error(
        '[brutalist-checkbox-indicator] asCheckboxIndicator must project Indicator state handles.'
      );
    }
    const { checked } = state;

    def.feedback.style.use(tw(INDICATOR_BASE_TOKENS));

    def.rule({
      when: (w) => w.state(checked).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-100')),
    });
    def.rule({
      when: (w) => w.state(checked).eq(false),
      intent: (i) => i.feedback.style.use(tw('opacity-0')),
    });
  },
});

export default checkboxIndicator;
