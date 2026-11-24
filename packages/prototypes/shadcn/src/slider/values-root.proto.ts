import { definePrototype, tw } from '@proto.ui/core';
import {
  asSliderValuesRoot,
  type SliderValuesRootProps,
  type SliderValuesRootExposes,
} from '@proto.ui/prototypes-base/slider';
import { setupShadcnStyleScope, type ShadcnStyleProps } from '../style-scope';

export type ShadcnSliderValuesRootProps = SliderValuesRootProps & ShadcnStyleProps;

export default definePrototype<ShadcnSliderValuesRootProps, SliderValuesRootExposes>({
  name: 'shadcn-slider-values-root',
  setup(def) {
    const inherited = asSliderValuesRoot();
    setupShadcnStyleScope(def);
    def.feedback.style.use(tw('flex w-full min-w-0 flex-wrap items-center gap-3 text-foreground'));
    def.rule({
      when: (w) => w.prop('orientation').eq('vertical'),
      intent: (i) => i.feedback.style.use(tw('h-full w-auto flex-col flex-nowrap min-h-40')),
    });
    return inherited.render;
  },
});
