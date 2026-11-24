import type { SliderValuesPartExposes } from '@proto.ui/prototypes-base/slider';
import type { SliderValuesPartProps } from '@proto.ui/prototypes-base/slider';
import { definePrototype, tw } from '@proto.ui/core';
import { asSliderValuesTrack } from '@proto.ui/prototypes-base/slider';
export default definePrototype<SliderValuesPartProps, SliderValuesPartExposes>({
  name: 'brutalist-slider-values-track',
  setup(def) {
    const inherited = asSliderValuesTrack();
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
