import type { SliderPartExposes } from '@proto.ui/prototypes-base/slider';
import type { SliderPartProps } from '@proto.ui/prototypes-base/slider';
import { definePrototype, tw } from '@proto.ui/core';
import { asSliderTrack } from '@proto.ui/prototypes-base/slider';
export default definePrototype<SliderPartProps, SliderPartExposes>({
  name: 'brutalist-slider-track',
  setup(def) {
    const inherited = asSliderTrack();
    def.feedback.style.use(
      tw(
        'relative block h-4 w-full touch-none select-none rounded-base border-2 border-black bg-secondary-background'
      )
    );
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.orientation).eq('vertical'),
      intent: (i) => i.feedback.style.use(tw('h-48 w-4')),
    });
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50')),
    });
    return inherited.render;
  },
});
