import type {
  SliderValuesRootProps,
  SliderValuesRootExposes,
} from '@proto.ui/prototypes-base/slider';
import { definePrototype, tw } from '@proto.ui/core';
import { asSliderValuesRoot } from '@proto.ui/prototypes-base/slider';
export default definePrototype<SliderValuesRootProps, SliderValuesRootExposes>({
  name: 'brutalist-slider-values-root',
  setup(def) {
    const inherited = asSliderValuesRoot();
    def.feedback.style.use(
      tw('flex w-full min-w-0 flex-wrap items-center gap-3 font-sans font-medium text-foreground')
    );
    def.rule({
      when: (w) => w.prop('orientation').eq('vertical'),
      intent: (i) => i.feedback.style.use(tw('h-full w-auto flex-col flex-nowrap min-h-40')),
    });
    return inherited.render;
  },
});
