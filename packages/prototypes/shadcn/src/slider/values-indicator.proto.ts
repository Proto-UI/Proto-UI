import { definePrototype, tw } from '@proto.ui/core';
import {
  asSliderValuesIndicator,
  type SliderValuesPartExposes,
} from '@proto.ui/prototypes-base/slider';
import {
  setupSliderValuesStyle,
  VALUES_RANGE,
  type ShadcnSliderValuesPartProps,
} from './values-visual';

export default definePrototype<ShadcnSliderValuesPartProps, SliderValuesPartExposes>({
  name: 'shadcn-slider-values-indicator',
  setup(def) {
    const inherited = asSliderValuesIndicator();
    const state = inherited.stateHandles!;
    const style = setupSliderValuesStyle(def);
    def.feedback.style.use(
      tw(
        'pointer-events-none absolute left-[calc(var(--pui-start-percentage)*1%)] top-1/2 -translate-y-1/2 bg-primary select-none'
      )
    );
    def.rule({
      when: (w) => w.state(state.orientation).eq('vertical'),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'left-1/2 top-auto bottom-[calc(var(--pui-start-percentage)*1%)] -translate-x-1/2 translate-y-0'
          )
        ),
    });
    for (const [id, recipe] of Object.entries(VALUES_RANGE)) {
      def.rule({
        when: (w) => w.all(w.state(style).eq(id), w.state(state.orientation).eq('horizontal')),
        intent: (i) => i.feedback.style.use(recipe.horizontal),
      });
      def.rule({
        when: (w) => w.all(w.state(style).eq(id), w.state(state.orientation).eq('vertical')),
        intent: (i) => i.feedback.style.use(recipe.vertical),
      });
    }
    def.rule({
      when: (w) =>
        w.all(w.state(state.direction).eq('rtl'), w.state(state.orientation).eq('horizontal')),
      intent: (i) =>
        i.feedback.style.use(tw('left-auto right-[calc(var(--pui-start-percentage)*1%)]')),
    });
    return inherited.render;
  },
});
