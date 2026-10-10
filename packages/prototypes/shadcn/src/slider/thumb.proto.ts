import type { SliderPartProps } from '@proto.ui/prototypes-base/slider';
import { definePrototype, tw } from '@proto.ui/core';
import { asSliderThumb } from '@proto.ui/prototypes-base/slider';
export default definePrototype<SliderPartProps, Record<string, unknown>>({
  name: 'shadcn-slider-thumb',
  setup(def) {
    const inherited = asSliderThumb();
    def.feedback.style.use(
      tw(
        'absolute left-[calc(var(--pui-percentage)*1%)] top-1/2 block size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-background outline-none'
      )
    );
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw('ring-2 ring-ring ring-offset-2')),
    });
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-not-allowed')),
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
    return inherited.render;
  },
});
