import type { SliderPartExposes } from '@proto.ui/prototypes-base/slider';
import type { SliderPartProps } from '@proto.ui/prototypes-base/slider';
import { definePrototype, tw } from '@proto.ui/core';
import { refreshSliderPaint } from './paint';
import { asSliderTrack } from '@proto.ui/prototypes-base/slider';
export default definePrototype<SliderPartProps, SliderPartExposes>({
  name: 'shadcn-slider-track',
  setup(def) {
    const inherited = asSliderTrack();
    def.feedback.style.use(tw('relative block h-3 w-full select-none'));
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.orientation).eq('vertical'),
      intent: (i) => i.feedback.style.use(tw('h-full min-h-40 w-3')),
    });
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50')),
    });
    const orientation = inherited.stateHandles!.orientation;
    refreshSliderPaint(def, [orientation]);
    return (r) => [
      r.el('div', {
        style:
          orientation.get() === 'vertical'
            ? tw(
                'pointer-events-none absolute left-1/2 top-0 h-full w-1 -translate-x-1/2 rounded-full bg-muted'
              )
            : tw(
                'pointer-events-none absolute left-0 top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-muted'
              ),
      }),
      r.slot(),
    ];
  },
});
