import type { SliderValuesPartExposes } from '@proto.ui/prototypes-base/slider';
import type { SliderValuesPartProps } from '@proto.ui/prototypes-base/slider';
import { definePrototype, tw } from '@proto.ui/core';
import { asSliderValuesIndicator } from '@proto.ui/prototypes-base/slider';
export default definePrototype<SliderValuesPartProps, SliderValuesPartExposes>({
  name: 'brutalist-slider-values-indicator',
  setup(def) {
    const inherited = asSliderValuesIndicator();
    def.feedback.style.use(
      tw(
        'pointer-events-none absolute left-[calc(var(--pui-start-percentage)*1%)] top-0 h-full w-[calc(var(--pui-extent)*1%)] rounded-sm bg-primary'
      )
    );
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.orientation).eq('vertical'),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'left-0 top-auto bottom-[calc(var(--pui-start-percentage)*1%)] h-[calc(var(--pui-extent)*1%)] w-full'
          )
        ),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(inherited.stateHandles!.direction).eq('rtl'),
          w.state(inherited.stateHandles!.orientation).eq('horizontal')
        ),
      intent: (i) =>
        i.feedback.style.use(tw('left-auto right-[calc(var(--pui-start-percentage)*1%)]')),
    });
    return inherited.render;
  },
});
