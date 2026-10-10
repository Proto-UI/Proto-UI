import type { SliderPartProps } from '@proto.ui/prototypes-base/slider';
import { definePrototype, tw } from '@proto.ui/core';
import { asSliderTrack } from '@proto.ui/prototypes-base/slider';
export default definePrototype<SliderPartProps, Record<string, unknown>>({
  name: 'liquid-glass-slider-track',
  setup(def) {
    const inherited = asSliderTrack();
    def.feedback.style.use(tw('relative block h-3 w-full rounded-full bg-muted'));
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.orientation).eq('vertical'),
      intent: (i) => i.feedback.style.use(tw('h-48 w-3')),
    });
    return inherited.render;
  },
});
