import type { SliderPartExposes } from '@proto.ui/prototypes-base/slider';
import type { SliderPartProps } from '@proto.ui/prototypes-base/slider';
import { definePrototype, tw } from '@proto.ui/core';
import { asSliderIndicator } from '@proto.ui/prototypes-base/slider';
export default definePrototype<SliderPartProps, SliderPartExposes>({
  name: 'bootstrap-2-3-2-slider-indicator',
  setup(def) {
    const inherited = asSliderIndicator();
    def.feedback.style.use(
      tw(
        'absolute left-0 top-0 h-full w-[calc(var(--pui-display-percentage)*1%)] rounded-[4px] bg-[linear-gradient(#149bdf,#0480be)] shadow-[inset_0_-1px_0_rgb(0_0_0/15%)]'
      )
    );
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.orientation).eq('vertical'),
      intent: (i) =>
        i.feedback.style.use(
          tw('top-auto bottom-0 h-[calc(var(--pui-display-percentage)*1%)] w-full')
        ),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(inherited.stateHandles!.direction).eq('rtl'),
          w.state(inherited.stateHandles!.orientation).eq('horizontal')
        ),
      intent: (i) => i.feedback.style.use(tw('left-auto right-0')),
    });
    return inherited.render;
  },
});
