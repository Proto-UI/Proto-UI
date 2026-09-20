import { definePrototype, tw } from '@proto.ui/core';
import { asRadioGroupIndicator } from '@proto.ui/prototypes-base/radio-group';
import type { ShadcnRadioGroupIndicatorExposes, ShadcnRadioGroupIndicatorProps } from './types';

const radioGroupIndicator = definePrototype<
  ShadcnRadioGroupIndicatorProps,
  ShadcnRadioGroupIndicatorExposes
>({
  name: 'shadcn-radio-group-indicator',
  setup(def) {
    const state = asRadioGroupIndicator().stateHandles;
    if (!state) {
      throw new Error(
        '[shadcn-radio-group-indicator] asRadioGroupIndicator must project Indicator state handles.'
      );
    }
    def.feedback.style.use(
      tw('flex size-2 shrink-0 items-center justify-center opacity-0 transition-none')
    );
    def.rule({
      when: (when) => when.state(state.checked).eq(true),
      intent: (intent) => intent.feedback.style.use(tw('opacity-100')),
    });

    return (renderer) => [
      renderer.r.slot(),
      renderer.svg.root(
        {
          viewBox: '0 0 24 24',
          'aria-hidden': 'true',
          width: '100%',
          height: '100%',
          fill: 'currentColor',
          stroke: 'currentColor',
          strokeWidth: 2,
        },
        renderer.svg.circle({ cx: 12, cy: 12, r: 10 })
      ),
    ];
  },
});

export default radioGroupIndicator;
