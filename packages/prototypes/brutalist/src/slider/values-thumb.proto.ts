import type { SliderValuesThumbExposes } from '@proto.ui/prototypes-base/slider';
import type { SliderValuesPartProps } from '@proto.ui/prototypes-base/slider';
import { definePrototype, tw } from '@proto.ui/core';
import { asSliderValuesThumb } from '@proto.ui/prototypes-base/slider';
import { BRUTALIST_FOCUS_TOKENS } from '../style';
export default definePrototype<SliderValuesPartProps, SliderValuesThumbExposes>({
  name: 'brutalist-slider-values-thumb',
  setup(def) {
    const inherited = asSliderValuesThumb();
    const state = inherited.stateHandles!;
    def.feedback.style.use(
      tw(
        'absolute left-[calc(var(--pui-percentage)*1%)] top-1/2 block size-6 -translate-x-1/2 -translate-y-1/2 rounded-base border-2 border-black bg-secondary-background shadow-[2px_2px_0_0_#000] cursor-pointer outline-none select-none'
      )
    );
    def.rule({
      when: (w) => w.all(w.state(state.dragging).eq(true), w.state(state.disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw('bg-primary shadow-none')),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw(BRUTALIST_FOCUS_TOKENS)),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-not-allowed shadow-none')),
    });
    def.rule({
      when: (w) => w.state(state.orientation).eq('vertical'),
      intent: (i) =>
        i.feedback.style.use(
          tw('left-1/2 top-auto bottom-[calc(var(--pui-percentage)*1%)] translate-y-1/2')
        ),
    });
    def.rule({
      when: (w) =>
        w.all(w.state(state.direction).eq('rtl'), w.state(state.orientation).eq('horizontal')),
      intent: (i) =>
        i.feedback.style.use(
          tw('left-auto right-[calc(var(--pui-percentage)*1%)] translate-x-1/2')
        ),
    });
    return inherited.render;
  },
});
