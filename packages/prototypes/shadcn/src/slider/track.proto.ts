import type { SliderPartExposes } from '@proto.ui/prototypes-base/slider';
import { definePrototype, type TemplateChild, tw } from '@proto.ui/core';
import { asSliderTrack } from '@proto.ui/prototypes-base/slider';
import { SHADCN_STYLE_IDS } from '../style-scope';
import { setupScalarSliderStyle, SCALAR_RAIL, type ShadcnSliderPartProps } from './scalar-visual';
export default definePrototype<ShadcnSliderPartProps, SliderPartExposes>({
  name: 'shadcn-slider-track',
  modules: asSliderTrack.modules,
  setup(def) {
    const inherited = asSliderTrack();
    const style = setupScalarSliderStyle(def);
    const rail = def.feedback.style.declareDecoration();
    def.feedback.style.use(tw('relative block h-3 w-full touch-none select-none'));
    def.rule({
      when: (w) =>
        w.all(
          w.state(inherited.stateHandles!.orientation).eq('horizontal'),
          w.any(
            w.state(style).eq('vega'),
            w.state(style).eq('maia'),
            w.state(style).eq('luma'),
            w.state(style).eq('rhea'),
            w.state(style).eq('new-york-v4')
          )
        ),
      intent: (i) => i.feedback.style.use(tw('h-4')),
    });
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.orientation).eq('vertical'),
      intent: (i) => i.feedback.style.use(tw('h-full')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(inherited.stateHandles!.orientation).eq('vertical'),
          w.any(
            w.state(style).eq('nova'),
            w.state(style).eq('lyra'),
            w.state(style).eq('mira'),
            w.state(style).eq('sera')
          )
        ),
      intent: (i) => i.feedback.style.use(tw('w-3')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(inherited.stateHandles!.orientation).eq('vertical'),
          w.any(
            w.state(style).eq('vega'),
            w.state(style).eq('maia'),
            w.state(style).eq('luma'),
            w.state(style).eq('rhea'),
            w.state(style).eq('new-york-v4')
          )
        ),
      intent: (i) => i.feedback.style.use(tw('w-4')),
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
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50')),
    });
    for (const profile of SHADCN_STYLE_IDS) {
      def.rule({
        when: (w) =>
          w.all(
            w.state(style).eq(profile),
            w.state(inherited.stateHandles!.orientation).eq('horizontal')
          ),
        intent: (i) => i.feedback.style.to(rail).use(SCALAR_RAIL[profile].horizontal),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.state(style).eq(profile),
            w.state(inherited.stateHandles!.orientation).eq('vertical')
          ),
        intent: (i) => i.feedback.style.to(rail).use(SCALAR_RAIL[profile].vertical),
      });
    }
    return (r) => [
      r.decoration(rail),
      inherited.render ? (inherited.render(r) as TemplateChild) : r.slot(),
    ];
  },
});
