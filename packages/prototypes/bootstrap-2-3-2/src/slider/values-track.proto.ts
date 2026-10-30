import { definePrototype, tw } from '@proto.ui/core';
import {
  asSliderValuesTrack,
  type SliderValuesPartProps,
  type SliderValuesPartExposes,
} from '@proto.ui/prototypes-base/slider';

export default definePrototype<SliderValuesPartProps, SliderValuesPartExposes>({
  name: 'bootstrap-2-3-2-slider-values-track',
  setup(def) {
    const inherited = asSliderValuesTrack();
    // Structural rail only, not a Bootstrap plugin or scalar AxisInput owner.
    def.feedback.style.use(tw('relative block h-[6px] w-full rounded-[4px] bg-secondary'));
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.orientation).eq('vertical'),
      intent: (i) => i.feedback.style.use(tw('h-[200px] w-[6px]')),
    });
    return inherited.render;
  },
});
