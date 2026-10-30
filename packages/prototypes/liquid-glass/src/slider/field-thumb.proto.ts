import type { SliderFieldThumbExposes } from '@proto.ui/prototypes-base/slider';
import type { SliderPartProps } from '@proto.ui/prototypes-base/slider';
import { definePrototype, tw } from '@proto.ui/core';
import { asSliderFieldThumb } from '@proto.ui/prototypes-base/slider';
import { COMMAND_FOCUS, COMMAND_HOVER } from '../interactive-surface';

export type LiquidGlassSliderFieldThumbProps = SliderPartProps & {
  material?: 'auto' | 'opaque';
};

export default definePrototype<LiquidGlassSliderFieldThumbProps, SliderFieldThumbExposes>({
  name: 'liquid-glass-slider-field-thumb',
  modules: asSliderFieldThumb.modules,
  setup(def) {
    const inherited = asSliderFieldThumb();
    const state = inherited.stateHandles!;
    def.props.define({
      material: { type: 'enum', options: ['auto', 'opaque'], empty: 'fallback' },
    });
    def.props.setDefaults({ material: 'auto' });
    def.feedback.style.use(
      tw(
        'absolute left-[calc(var(--pui-display-percentage)*1%)] top-1/2 block size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-background text-foreground outline-none shadow-sm'
      )
    );
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.hovered).eq(true),
          w.state(state.pressed).eq(false),
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
      intent: (i) => i.feedback.style.use(tw('cursor-not-allowed shadow-none')),
    });
    def.rule({
      when: (w) => w.state(state.orientation).eq('vertical'),
      intent: (i) =>
        i.feedback.style.use(
          tw('left-1/2 top-auto bottom-[calc(var(--pui-display-percentage)*1%)] translate-y-1/2')
        ),
    });
    def.feedback.material.declare({
      version: 2,
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('material').eq('auto'),
          w.state(state.pressed).eq(true),
          w.state(state.disabled).eq(false),
          w.state(state.readOnly).eq(false)
        ),
      intent: (i) =>
        i.feedback.material.use({
          intent: 'liquid-glass',
          variant: 'regular',
          deformation: { kind: 'press', phase: 'pressed', contact: 'pointer' },
        }),
    });
    def.rule({
      when: (w) =>
        w.all(w.state(state.direction).eq('rtl'), w.state(state.orientation).eq('horizontal')),
      intent: (i) =>
        i.feedback.style.use(
          tw('left-auto right-[calc(var(--pui-display-percentage)*1%)] translate-x-1/2')
        ),
    });
    return inherited.render;
  },
});
