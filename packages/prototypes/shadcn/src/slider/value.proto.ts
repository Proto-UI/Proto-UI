import type { SliderPartExposes } from '@proto.ui/prototypes-base/slider';
import { definePrototype, tw } from '@proto.ui/core';
import { asSliderValue } from '@proto.ui/prototypes-base/slider';
import { setupScalarSliderStyle, type ShadcnSliderPartProps } from './scalar-visual';
export default definePrototype<ShadcnSliderPartProps, SliderPartExposes>({
  name: 'shadcn-slider-value',
  modules: asSliderValue.modules,
  setup(def) {
    const inherited = asSliderValue();
    const style = setupScalarSliderStyle(def);
    def.feedback.style.use(tw('tabular-nums text-muted-foreground'));
    def.rule({
      when: (w) => w.any(w.state(style).eq('lyra'), w.state(style).eq('mira')),
      intent: (i) => i.feedback.style.use(tw('text-xs')),
    });
    def.rule({
      when: (w) => w.not(w.any(w.state(style).eq('lyra'), w.state(style).eq('mira'))),
      intent: (i) => i.feedback.style.use(tw('text-sm')),
    });
    def.rule({
      when: (w) => w.state(style).eq('mira'),
      intent: (i) => i.feedback.style.use(tw('leading-relaxed')),
    });
    return inherited.render;
  },
});
