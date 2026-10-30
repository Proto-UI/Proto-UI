import { sliderThumbPaint } from './paint';
import type { SliderThumbExposes } from '@proto.ui/prototypes-base/slider';
import { definePrototype, tw } from '@proto.ui/core';
import { asSliderThumb } from '@proto.ui/prototypes-base/slider';
import { SHADCN_STYLE_IDS } from '../style-scope';
import {
  setupScalarSliderStyle,
  SCALAR_THUMB_HIT,
  type ShadcnSliderPartProps,
} from './scalar-visual';
export default definePrototype<ShadcnSliderPartProps, SliderThumbExposes>({
  name: 'shadcn-slider-thumb',
  modules: asSliderThumb.modules,
  setup(def) {
    const inherited = asSliderThumb();
    const style = setupScalarSliderStyle(def);
    def.feedback.style.use(
      tw(
        'absolute left-[calc(var(--pui-display-percentage)*1%)] top-1/2 flex items-center justify-center -translate-x-1/2 -translate-y-1/2 outline-none select-none'
      )
    );
    for (const profile of SHADCN_STYLE_IDS) {
      def.rule({
        when: (w) =>
          w.all(
            w.state(style).eq(profile),
            w.state(inherited.stateHandles!.orientation).eq('horizontal')
          ),
        intent: (i) => i.feedback.style.use(SCALAR_THUMB_HIT[profile].horizontal),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.state(style).eq(profile),
            w.state(inherited.stateHandles!.orientation).eq('vertical')
          ),
        intent: (i) => i.feedback.style.use(SCALAR_THUMB_HIT[profile].vertical),
      });
    }
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('pointer-events-none')),
    });
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.orientation).eq('vertical'),
      intent: (i) =>
        i.feedback.style.use(
          tw('left-1/2 top-auto bottom-[calc(var(--pui-display-percentage)*1%)] translate-y-1/2')
        ),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(inherited.stateHandles!.direction).eq('rtl'),
          w.state(inherited.stateHandles!.orientation).eq('horizontal')
        ),
      intent: (i) =>
        i.feedback.style.use(
          tw('left-auto right-[calc(var(--pui-display-percentage)*1%)] translate-x-1/2')
        ),
    });
    const paint = sliderThumbPaint(def, inherited.stateHandles!, style);
    return (r) => [r.decoration(paint), inherited.render ? inherited.render(r) : r.slot()];
  },
});
