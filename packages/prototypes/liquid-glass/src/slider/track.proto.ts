import type { SliderPartExposes } from '@proto.ui/prototypes-base/slider';
import type { SliderPartProps } from '@proto.ui/prototypes-base/slider';
import { definePrototype, tw } from '@proto.ui/core';
import { asSliderTrack } from '@proto.ui/prototypes-base/slider';
export default definePrototype<SliderPartProps, SliderPartExposes>({
  name: 'liquid-glass-slider-track',
  setup(def) {
    const inherited = asSliderTrack();
    def.feedback.style.use(
      tw('relative block h-1.5 w-full touch-none select-none rounded-full bg-muted')
    );
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.orientation).eq('vertical'),
      intent: (i) => i.feedback.style.use(tw('h-48 w-1.5')),
    });
    return inherited.render;
  },
});
