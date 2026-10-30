import { definePrototype, tw } from '@proto.ui/core';
import {
  asSliderValuesThumb,
  type SliderValuesThumbExposes,
} from '@proto.ui/prototypes-base/slider';
import {
  setupSliderValuesStyle,
  VALUES_THUMB_HIT,
  VALUES_THUMB_PAINT,
  type ShadcnSliderValuesPartProps,
} from './values-visual';

export default definePrototype<ShadcnSliderValuesPartProps, SliderValuesThumbExposes>({
  name: 'shadcn-slider-values-thumb',
  setup(def) {
    const inherited = asSliderValuesThumb();
    const state = inherited.stateHandles!;
    const style = setupSliderValuesStyle(def);
    const paint = def.feedback.style.declareDecoration();
    def.feedback.style.use(
      tw(
        'absolute left-[calc(var(--pui-percentage)*1%)] top-1/2 flex shrink-0 items-center justify-center -translate-x-1/2 -translate-y-1/2 outline-none select-none'
      )
    );
    for (const [id, recipe] of Object.entries(VALUES_THUMB_HIT))
      def.rule({
        when: (w) => w.state(style).eq(id),
        intent: (i) => i.feedback.style.use(recipe),
      });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('pointer-events-none opacity-50')),
    });
    def.rule({
      when: (w) => w.state(state.orientation).eq('vertical'),
      intent: (i) =>
        i.feedback.style.use(
          tw('left-1/2 top-auto bottom-[calc(var(--pui-percentage)*1%)] translate-y-1/2')
        ),
    });
    def.rule({
      when: (w) => w.all(w.state(state.orientation).eq('vertical'), w.state(style).eq('luma')),
      intent: (i) => i.feedback.style.use(tw('h-6 w-4')),
    });
    def.rule({
      when: (w) =>
        w.all(w.state(state.direction).eq('rtl'), w.state(state.orientation).eq('horizontal')),
      intent: (i) =>
        i.feedback.style.use(
          tw('left-auto right-[calc(var(--pui-percentage)*1%)] translate-x-1/2')
        ),
    });
    for (const [id, recipe] of Object.entries(VALUES_THUMB_PAINT)) {
      def.rule({
        when: (w) =>
          w.all(
            w.state(style).eq(id),
            w.any(
              w.state(state.disabled).eq(true),
              w.all(w.state(state.focusVisible).eq(false), w.state(state.hovered).eq(false))
            )
          ),
        intent: (i) => i.feedback.style.to(paint).use(recipe.rest),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.state(style).eq(id),
            w.state(state.disabled).eq(false),
            w.state(state.focusVisible).eq(false),
            w.state(state.hovered).eq(true)
          ),
        intent: (i) => i.feedback.style.to(paint).use(recipe.hover),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.state(style).eq(id),
            w.state(state.disabled).eq(false),
            w.state(state.focusVisible).eq(true)
          ),
        intent: (i) => i.feedback.style.to(paint).use(recipe.focus),
      });
    }
    def.rule({
      when: (w) => w.all(w.state(style).eq('luma'), w.state(state.orientation).eq('vertical')),
      intent: (i) => i.feedback.style.to(paint).use(tw('h-6 w-4')),
    });
    for (const id of ['luma', 'rhea'])
      def.rule({
        when: (w) => w.all(w.state(style).eq(id), w.not(w.meta('colorScheme').eq('dark'))),
        intent: (i) => i.feedback.style.to(paint).use(tw('bg-clip-padding')),
      });
    // Values has no pressed/input-origin fact. Do not manufacture upstream
    // Nova/Lyra/Mira active:ring from a second pointer/Trigger owner.
    return (r) => {
      const content = inherited.render!(r);
      return Array.isArray(content)
        ? [r.decoration(paint), ...content]
        : [r.decoration(paint), content];
    };
  },
});
