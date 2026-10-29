import { definePrototype, tw } from '@proto.ui/core';
import {
  asSliderValuesThumb,
  type SliderValuesPartProps,
  type SliderValuesThumbExposes,
} from '@proto.ui/prototypes-base/slider';
import { COMMAND_FOCUS, COMMAND_HOVER } from '../interactive-surface';

export type LiquidGlassSliderValuesThumbProps = SliderValuesPartProps & {
  material?: 'auto' | 'opaque';
};

export default definePrototype<LiquidGlassSliderValuesThumbProps, SliderValuesThumbExposes>({
  name: 'liquid-glass-slider-values-thumb',
  setup(def) {
    const inherited = asSliderValuesThumb();
    const state = inherited.stateHandles!;
    def.props.define({
      material: { type: 'enum', options: ['auto', 'opaque'], empty: 'fallback' },
    });
    def.props.setDefaults({ material: 'auto' });
    // Public Apple Sliders/Materials guidance informs this Proto control;
    // neither track content nor every decorative child receives material.
    def.feedback.style.use(
      tw(
        'absolute left-[calc(var(--pui-percentage)*1%)] top-1/2 block size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-background text-foreground shadow-sm outline-none select-none'
      )
    );
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.hovered).eq(true),
          w.state(state.disabled).eq(false),
          w.state(state.focusVisible).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw(COMMAND_HOVER)),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS)),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-not-allowed shadow-none')),
    });
    def.feedback.material.declare({
      version: 2,
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    });
    def.rule({
      when: (w) => w.all(w.prop('material').eq('auto'), w.state(state.disabled).eq(false)),
      intent: (i) => i.feedback.material.use({ intent: 'liquid-glass', variant: 'regular' }),
    });
    // Static candidate only: Values has no pressed or physical-input session
    // facts, so it cannot lawfully request press deformation or swap focus.
    def.rule({
      when: (w) => w.state(state.orientation).eq('vertical'),
      intent: (i) =>
        i.feedback.style.use(
          tw('left-1/2 top-auto bottom-[calc(var(--pui-percentage)*1%)] translate-y-1/2')
        ),
    });
    def.rule({
      when: (w) =>
        w.all(w.state(state.direction).eq('rtl'), w.state(state.orientation).eq('horizontal')),
      intent: (i) =>
        i.feedback.style.use(
          tw('left-auto right-[calc(var(--pui-percentage)*1%)] translate-x-1/2')
        ),
    });
    return inherited.render;
  },
});
