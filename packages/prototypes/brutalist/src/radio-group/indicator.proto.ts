import { definePrototype, tw } from '@proto.ui/core';
import { asRadioGroupIndicator } from '@proto.ui/prototypes-base/radio-group';
import type {
  BrutalistRadioGroupIndicatorExposes,
  BrutalistRadioGroupIndicatorProps,
} from './types';

// Source: neobrutalism-components radio-group.tsx@3306a802 — a Lucide Circle
// rendered `size-2 fill-current text-current`. The host-neutral SVG dot is
// passive: it is aria-hidden, never an activation or focus target, and derives
// checked purely from the containing Item through the inherited context.
const INDICATOR_SURFACE_TOKENS =
  'flex size-2 shrink-0 items-center justify-center text-current opacity-0 transition-none';

const radioGroupIndicator = definePrototype<
  BrutalistRadioGroupIndicatorProps,
  BrutalistRadioGroupIndicatorExposes
>({
  name: 'brutalist-radio-group-indicator',
  setup(def) {
    const state = asRadioGroupIndicator().stateHandles;
    if (!state) {
      throw new Error(
        '[brutalist-radio-group-indicator] asRadioGroupIndicator must project Indicator state handles.'
      );
    }
    const { checked } = state;

    def.feedback.style.use(tw(INDICATOR_SURFACE_TOKENS));
    def.rule({
      when: (when) => when.state(checked).eq(true),
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
          stroke: 'none',
        },
        renderer.svg.circle({ cx: 12, cy: 12, r: 12 })
      ),
    ];
  },
});

export default radioGroupIndicator;
