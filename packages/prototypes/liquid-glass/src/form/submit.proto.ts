import {
  COMMAND_HOVER,
  COMMAND_PRESS,
  COMMAND_FOCUS,
  COMMAND_DISABLED,
} from '../interactive-surface';
import { definePrototype, tw } from '@proto.ui/core';
import { asFormSubmit, type FormActionExposes } from '@proto.ui/prototypes-base/form';
import type { LiquidGlassFormActionProps, LiquidGlassFormActionVariant } from './types';

const FILLS: Record<LiquidGlassFormActionVariant, string> = {
  regular: 'bg-secondary text-secondary-foreground',
  prominent: 'bg-primary text-primary-foreground',
  destructive: 'bg-destructive text-destructive-foreground',
};

// Passive liquid-glass Button paint; Base Form remains the sole action owner.
// Keep rules in the owning setup so source lowering can resolve the actual borrowed states.
export default definePrototype<LiquidGlassFormActionProps, FormActionExposes>({
  name: 'liquid-glass-form-submit',
  modules: asFormSubmit.modules,
  setup(def) {
    const inherited = asFormSubmit();
    const state = inherited.stateHandles!;
    def.props.define({
      variant: {
        type: 'enum',
        options: ['regular', 'prominent', 'destructive'],
        empty: 'fallback',
      },
      material: { type: 'enum', options: ['auto', 'opaque'], empty: 'fallback' },
    });
    def.props.setDefaults({ variant: 'prominent', material: 'auto' });
    def.feedback.style.use(
      tw(
        'inline-flex shrink-0 items-center justify-center rounded-full border border-border px-5 py-2 text-sm font-medium whitespace-nowrap select-none cursor-pointer shadow-sm'
      )
    );
    for (const variant of ['regular', 'prominent', 'destructive'] as const) {
      def.rule({
        when: (w) => w.prop('variant').eq(variant),
        intent: (i) => i.feedback.style.use(tw(FILLS[variant])),
      });
    }
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
    def.feedback.material.declare({
      version: 2,
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    });
    for (const variant of ['regular', 'prominent', 'destructive'] as const) {
      const tint = variant === 'regular' ? {} : { tint: 'style-fill' as const };
      for (const pressed of [false, true]) {
        def.rule({
          when: (w) =>
            w.all(
              w.prop('variant').eq(variant),
              w.prop('material').eq('auto'),
              w.state(state.disabled).eq(false),
              w.state(state.pressed).eq(pressed),
              w.not(w.meta('preference.reducedTransparency').eq('reduce')),
              w.not(w.meta('preference.increasedContrast').eq('more')),
              w.not(w.meta('preference.reducedMotion').eq('reduce'))
            ),
          intent: (i) =>
            i.feedback.material.use({
              intent: 'liquid-glass',
              variant: 'regular',
              ...tint,
              deformation: {
                kind: 'press',
                phase: pressed ? 'pressed' : 'rest',
                contact: 'pointer',
              },
            }),
        });
      }
      def.rule({
        when: (w) =>
          w.all(
            w.prop('variant').eq(variant),
            w.prop('material').eq('auto'),
            w.state(state.disabled).eq(false),
            w.not(w.meta('preference.reducedTransparency').eq('reduce')),
            w.not(w.meta('preference.increasedContrast').eq('more')),
            w.meta('preference.reducedMotion').eq('reduce')
          ),
        intent: (i) =>
          i.feedback.material.use({
            intent: 'liquid-glass',
            variant: 'regular',
            ...tint,
          }),
      });
    }
    def.rule({
      when: (w) => w.all(w.state(state.pressed).eq(true), w.state(state.disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw(COMMAND_PRESS)),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS)),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_DISABLED)),
    });
    return inherited.render;
  },
});
