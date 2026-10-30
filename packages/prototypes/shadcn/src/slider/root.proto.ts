import type { SliderRootExposes } from '@proto.ui/prototypes-base/slider';
import { definePrototype, tw } from '@proto.ui/core';
import { asSliderRoot } from '@proto.ui/prototypes-base/slider';
import { setupShadcnStyleScope } from '../style-scope';
import { setupScalarSliderStyle, type ShadcnSliderRootProps } from './scalar-visual';
export default definePrototype<ShadcnSliderRootProps, SliderRootExposes>({
  name: 'shadcn-slider-root',
  modules: asSliderRoot.modules,
  setup(def) {
    const inherited = asSliderRoot();
    setupShadcnStyleScope(def);
    const style = setupScalarSliderStyle(def);
    def.feedback.style.use(tw('flex w-full min-w-0 flex-wrap items-center gap-3 text-foreground'));
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.orientation).eq('vertical'),
      intent: (i) => i.feedback.style.use(tw('h-full w-auto flex-col flex-nowrap')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(inherited.stateHandles!.orientation).eq('vertical'),
          w.state(style).eq('new-york-v4')
        ),
      intent: (i) => i.feedback.style.use(tw('min-h-[11rem]')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(inherited.stateHandles!.orientation).eq('vertical'),
          w.not(w.state(style).eq('new-york-v4'))
        ),
      intent: (i) => i.feedback.style.use(tw('min-h-40')),
    });
    return inherited.render;
  },
});
