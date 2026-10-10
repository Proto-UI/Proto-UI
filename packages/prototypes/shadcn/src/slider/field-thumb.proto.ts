import { sliderThumbPaint } from './paint';
import type { SliderFieldThumbExposes } from '@proto.ui/prototypes-base/slider';
import type { SliderPartProps } from '@proto.ui/prototypes-base/slider';
import { definePrototype, tw } from '@proto.ui/core';
import { asSliderFieldThumb, SLIDER_FAMILY } from '@proto.ui/prototypes-base/slider';
import { FIELD_FAMILY } from '@proto.ui/prototypes-base/field';
export default definePrototype<SliderPartProps, SliderFieldThumbExposes>({
  name: 'shadcn-slider-field-thumb',
  setup(def) {
    const inherited = asSliderFieldThumb();
    def.feedback.style.use(
      tw(
        'absolute left-[calc(var(--pui-percentage)*1%)] top-1/2 flex size-7 items-center justify-center -translate-x-1/2 -translate-y-1/2 outline-none select-none'
      )
    );
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('pointer-events-none')),
    });
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.orientation).eq('vertical'),
      intent: (i) =>
        i.feedback.style.use(
          tw('left-1/2 top-auto bottom-[calc(var(--pui-percentage)*1%)] translate-y-1/2')
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
          tw('left-auto right-[calc(var(--pui-percentage)*1%)] translate-x-1/2')
        ),
    });
    const paint = sliderThumbPaint(def, inherited.stateHandles!, [SLIDER_FAMILY, FIELD_FAMILY]);
    return (r) => [paint(r), r.slot()];
  },
});
