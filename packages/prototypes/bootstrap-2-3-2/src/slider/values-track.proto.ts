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
    // Structural rail matching Bootstrap 2.3.2 recessed progress track vocabulary.
    def.feedback.style.use(
      tw(
        'relative block h-[20px] w-full touch-none select-none rounded-[4px] bg-[linear-gradient(#f5f5f5,#f9f9f9)] shadow-[inset_0_1px_2px_rgb(0_0_0/10%)]'
      )
    );
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.orientation).eq('vertical'),
      intent: (i) => i.feedback.style.use(tw('h-[200px] w-[20px]')),
    });
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-65')),
    });
    return inherited.render;
  },
});
