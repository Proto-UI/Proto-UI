import type { SliderPartExposes } from '@proto.ui/prototypes-base/slider';
import type { SliderPartProps } from '@proto.ui/prototypes-base/slider';
import { definePrototype, tw } from '@proto.ui/core';
import { asSliderTrack } from '@proto.ui/prototypes-base/slider';
export default definePrototype<SliderPartProps, SliderPartExposes>({
  name: 'bootstrap-2-3-2-slider-track',
  setup(def) {
    const inherited = asSliderTrack();
    def.feedback.style.use(
      tw(
        'relative block rounded-[4px] bg-[linear-gradient(#f5f5f5,#f9f9f9)] shadow-[inset_0_1px_2px_rgb(0_0_0/10%)]'
      )
    );
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.orientation).eq('horizontal'),
      intent: (i) => i.feedback.style.use(tw('h-[20px] w-full')),
    });
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.orientation).eq('vertical'),
      intent: (i) => i.feedback.style.use(tw('h-full w-[20px]')),
    });
    return inherited.render;
  },
});
