import { definePrototype, tw } from '@proto.ui/core';
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
    // Structural layout, not the scalar Track's AxisInput/capture owner.
    def.feedback.style.use(tw('relative block h-3 w-full select-none'));
    def.rule({
      when: (w) => w.state(state.orientation).eq('vertical'),
      intent: (i) => i.feedback.style.use(tw('h-full min-h-40 w-3')),
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
    for (const [id, recipe] of Object.entries(VALUES_RAIL)) {
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
