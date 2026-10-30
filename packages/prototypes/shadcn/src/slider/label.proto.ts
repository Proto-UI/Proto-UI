import type { SliderPartExposes } from '@proto.ui/prototypes-base/slider';
import { definePrototype, tw } from '@proto.ui/core';
import { asSliderLabel } from '@proto.ui/prototypes-base/slider';
import { setupScalarSliderStyle, type ShadcnSliderPartProps } from './scalar-visual';
export default definePrototype<ShadcnSliderPartProps, SliderPartExposes>({
  name: 'shadcn-slider-label',
  modules: asSliderLabel.modules,
  setup(def) {
    const inherited = asSliderLabel();
    const style = setupScalarSliderStyle(def);
    def.feedback.style.use(tw('block w-full font-medium'));
    def.rule({
      when: (w) =>
        w.any(w.state(style).eq('lyra'), w.state(style).eq('mira'), w.state(style).eq('sera')),
      intent: (i) => i.feedback.style.use(tw('text-xs')),
    });
    def.rule({
      when: (w) =>
        w.not(
          w.any(w.state(style).eq('lyra'), w.state(style).eq('mira'), w.state(style).eq('sera'))
        ),
      intent: (i) => i.feedback.style.use(tw('text-sm')),
    });
    def.rule({
      when: (w) => w.state(style).eq('mira'),
      intent: (i) => i.feedback.style.use(tw('leading-relaxed')),
    });
    def.rule({
      when: (w) => w.state(style).eq('sera'),
      intent: (i) => i.feedback.style.use(tw('font-semibold uppercase tracking-wide')),
    });
    return inherited.render;
  },
});
