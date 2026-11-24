import { definePrototype, tw } from '@proto.ui/core';
import type { ShadcnStyleId } from '../style-scope';
import {
  asSliderValuesTrack,
  type SliderValuesPartExposes,
} from '@proto.ui/prototypes-base/slider';
import {
  setupSliderValuesStyle,
  VALUES_RAIL,
  type ShadcnSliderValuesPartProps,
} from './values-visual';

export default definePrototype<ShadcnSliderValuesPartProps, SliderValuesPartExposes>({
  name: 'shadcn-slider-values-track',
  setup(def) {
    const inherited = asSliderValuesTrack();
    const state = inherited.stateHandles!;
    const style = setupSliderValuesStyle(def);
    const rail = def.feedback.style.declareDecoration();
    // Family rail paint; the inherited Values Track owns the shared AxisInput lease.
    def.feedback.style.use(tw('relative block h-3 w-full touch-none select-none'));
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.orientation).eq('horizontal'),
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
      when: (w) => w.state(state.orientation).eq('vertical'),
      intent: (i) => i.feedback.style.use(tw('h-full min-h-40 w-3')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.orientation).eq('vertical'),
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
        w.all(w.state(state.orientation).eq('vertical'), w.state(style).eq('new-york-v4')),
      intent: (i) => i.feedback.style.use(tw('min-h-[11rem]')),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50')),
    });
    for (const [id, recipe] of Object.entries(VALUES_RAIL) as [
      ShadcnStyleId,
      (typeof VALUES_RAIL)[ShadcnStyleId],
    ][]) {
      def.rule({
        when: (w) => w.all(w.state(style).eq(id), w.state(state.orientation).eq('horizontal')),
        intent: (i) => i.feedback.style.to(rail).use(recipe.horizontal),
      });
      def.rule({
        when: (w) => w.all(w.state(style).eq(id), w.state(state.orientation).eq('vertical')),
        intent: (i) => i.feedback.style.to(rail).use(recipe.vertical),
      });
    }
    return (r) => {
      const content = inherited.render!(r);
      return Array.isArray(content)
        ? [r.decoration(rail), ...content]
        : [r.decoration(rail), content];
    };
  },
});
