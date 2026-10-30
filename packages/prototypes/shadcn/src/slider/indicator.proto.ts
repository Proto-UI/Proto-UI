import type { SliderPartExposes } from '@proto.ui/prototypes-base/slider';
import { definePrototype, tw } from '@proto.ui/core';
import { asSliderIndicator } from '@proto.ui/prototypes-base/slider';
import { SHADCN_STYLE_IDS } from '../style-scope';
import { setupScalarSliderStyle, SCALAR_RANGE, type ShadcnSliderPartProps } from './scalar-visual';
export default definePrototype<ShadcnSliderPartProps, SliderPartExposes>({
  name: 'shadcn-slider-indicator',
  modules: asSliderIndicator.modules,
  setup(def) {
    const inherited = asSliderIndicator();
    const style = setupScalarSliderStyle(def);
    def.feedback.style.use(
      tw(
        'pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 w-[calc(var(--pui-display-percentage)*1%)] bg-primary'
      )
    );
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.orientation).eq('vertical'),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'left-1/2 top-auto bottom-0 h-[calc(var(--pui-display-percentage)*1%)] -translate-x-1/2 translate-y-0'
          )
        ),
    });
    for (const profile of SHADCN_STYLE_IDS) {
      def.rule({
        when: (w) =>
          w.all(
            w.state(style).eq(profile),
            w.state(inherited.stateHandles!.orientation).eq('horizontal')
          ),
        intent: (i) => i.feedback.style.use(SCALAR_RANGE[profile].horizontal),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.state(style).eq(profile),
            w.state(inherited.stateHandles!.orientation).eq('vertical')
          ),
        intent: (i) => i.feedback.style.use(SCALAR_RANGE[profile].vertical),
      });
    }
    def.rule({
      when: (w) =>
        w.all(
          w.state(inherited.stateHandles!.direction).eq('rtl'),
          w.state(inherited.stateHandles!.orientation).eq('horizontal')
        ),
      intent: (i) => i.feedback.style.use(tw('left-auto right-0')),
    });
    return inherited.render;
  },
});
