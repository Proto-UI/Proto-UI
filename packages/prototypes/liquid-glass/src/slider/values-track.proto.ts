import { definePrototype, tw } from '@proto.ui/core';
import {
  asSliderValuesTrack,
  type SliderValuesPartProps,
  type SliderValuesPartExposes,
} from '@proto.ui/prototypes-base/slider';

export default definePrototype<SliderValuesPartProps, SliderValuesPartExposes>({
  name: 'liquid-glass-slider-values-track',
  setup(def) {
    const inherited = asSliderValuesTrack();
    // Structural rail: no glass slot, pointer recognizer or capture owner.
    def.feedback.style.use(tw('relative block h-3 w-full rounded-full bg-muted'));
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.orientation).eq('vertical'),
      intent: (i) => i.feedback.style.use(tw('h-48 w-3')),
    });
    return inherited.render;
  },
});
