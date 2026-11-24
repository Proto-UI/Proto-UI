import { definePrototype, tw } from '@proto.ui/core';
import {
  asSliderValuesIndicator,
  type SliderValuesPartProps,
  type SliderValuesPartExposes,
} from '@proto.ui/prototypes-base/slider';

export default definePrototype<SliderValuesPartProps, SliderValuesPartExposes>({
  name: 'bootstrap-2-3-2-slider-values-indicator',
  setup(def) {
    const inherited = asSliderValuesIndicator();
    const state = inherited.stateHandles!;
    def.feedback.style.use(
      tw(
        'pointer-events-none absolute left-[calc(var(--pui-start-percentage)*1%)] top-0 h-full w-[calc(var(--pui-extent)*1%)] rounded-[4px] bg-[linear-gradient(#149bdf,#0480be)] shadow-[inset_0_-1px_0_rgb(0_0_0/15%)]'
      )
    );
    def.rule({
      when: (w) => w.state(state.orientation).eq('vertical'),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'left-0 top-auto bottom-[calc(var(--pui-start-percentage)*1%)] h-[calc(var(--pui-extent)*1%)] w-full'
          )
        ),
    });
    def.rule({
      when: (w) =>
        w.all(w.state(state.direction).eq('rtl'), w.state(state.orientation).eq('horizontal')),
      intent: (i) =>
        i.feedback.style.use(tw('left-auto right-[calc(var(--pui-start-percentage)*1%)]')),
    });
    return inherited.render;
  },
});
