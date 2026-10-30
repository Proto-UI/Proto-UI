import { definePrototype, tw } from '@proto.ui/core';
import {
  asSliderValuesThumb,
  type SliderValuesPartProps,
  type SliderValuesThumbExposes,
} from '@proto.ui/prototypes-base/slider';

export default definePrototype<SliderValuesPartProps, SliderValuesThumbExposes>({
  name: 'bootstrap-2-3-2-slider-values-thumb',
  setup(def) {
    const inherited = asSliderValuesThumb();
    const state = inherited.stateHandles!;
    // Bounded extension, not an upstream range-input recipe: .btn's 4px
    // corners, neutral border/fill and inset-light/drop shadow vocabulary.
    def.feedback.style.use(
      tw(
        'absolute left-[calc(var(--pui-percentage)*1%)] top-1/2 block size-[20px] -translate-x-1/2 -translate-y-1/2 rounded-[4px] border border-border bg-[#f5f5f5_linear-gradient(#fff,#e6e6e6)_0_0_repeat-x] text-foreground shadow-[inset_0_1px_0_rgb(255_255_255/20%),0_1px_2px_rgb(0_0_0/5%)] outline-none select-none'
      )
    );
    def.rule({
      when: (w) => w.all(w.state(state.hovered).eq(true), w.state(state.disabled).eq(false)),
      intent: (i) =>
        i.feedback.style.use(tw('bg-[#e6e6e6_linear-gradient(#fff,#e6e6e6)_0_-15px_repeat-x]')),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw('outline-1 outline-ring outline-offset-2 forced-colors-focus-outline')
        ),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw('bg-[#e6e6e6_none_0_0_repeat-x] opacity-65 cursor-not-allowed shadow-none')
        ),
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
