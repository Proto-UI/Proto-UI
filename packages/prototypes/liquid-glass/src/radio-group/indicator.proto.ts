import { definePrototype, tw } from '@proto.ui/core';
import { asRadioGroupIndicator } from '@proto.ui/prototypes-base/radio-group';
import type {
  LiquidGlassRadioGroupIndicatorExposes,
  LiquidGlassRadioGroupIndicatorProps,
} from './types';

// Passive indicator: paints the Item-published checked fact as a dot only.
// No value, focus, event, input or material owner; the Item root already
// carries the radio role and checked state.
export default definePrototype<
  LiquidGlassRadioGroupIndicatorProps,
  LiquidGlassRadioGroupIndicatorExposes
>({
  name: 'liquid-glass-radio-group-indicator',
  setup(def) {
    const inherited = asRadioGroupIndicator();
    const state = inherited.stateHandles;
    if (!state)
      throw new Error(
        '[liquid-glass-radio-group-indicator] Base Radio Indicator states are required.'
      );
    const { checked } = state;
    // currentColor inherits the Item's state-owned foreground (primary-foreground
    // while filled), so the dot stays readable in every governed state pair.
    def.feedback.style.use(tw('flex size-3 shrink-0 items-center justify-center opacity-0'));
    def.rule({
      when: (w) => w.state(checked).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-100')),
    });
    return (renderer) => [
      renderer.r.slot(),
      renderer.svg.root(
        {
          viewBox: '0 0 24 24',
          width: '100%',
          height: '100%',
          // The Item already carries the radio role and its checked state.
          'aria-hidden': 'true',
          fill: 'currentColor',
          stroke: 'none',
        },
        renderer.svg.circle({ cx: 12, cy: 12, r: 12 })
      ),
    ];
  },
});
