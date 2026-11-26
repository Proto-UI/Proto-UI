import {
  COMMAND_HOVER,
  COMMAND_PRESS,
  COMMAND_FOCUS,
  COMMAND_DISABLED,
} from '../interactive-surface';
import { definePrototype, tw } from '@proto.ui/core';
import { asButton, type ButtonExposes } from '@proto.ui/prototypes-base/button';

export type LiquidGlassButtonVariant = 'regular' | 'prominent' | 'destructive';
export type LiquidGlassButtonSize = 'sm' | 'default' | 'lg' | 'icon';

export interface ButtonProjectionProps {
  variant?: LiquidGlassButtonVariant;
  size?: LiquidGlassButtonSize;
  wrap?: boolean;
  disabled?: boolean;
  /** Auto enhances only when all live preference/support inputs are affirmative. */
  material?: 'auto' | 'opaque';
}

// Explicit optical intent uses the shared host provider. The same final opaque
// fill remains available without a source; CSS blur is not a substitute.
const FILLS: Record<LiquidGlassButtonVariant, string> = {
  regular: 'bg-secondary text-secondary-foreground',
  prominent: 'bg-primary text-primary-foreground',
  destructive: 'bg-destructive text-destructive-foreground',
};

const SIZES: Record<LiquidGlassButtonSize, string> = {
  sm: 'px-3.5 py-1.5 text-xs gap-1.5',
  default: 'px-5 py-2 text-sm gap-2',
  lg: 'px-6 py-2.5 text-base gap-2',
  icon: 'size-9 p-0',
};

export default definePrototype<ButtonProjectionProps, ButtonExposes>({
  name: 'liquid-glass-button',
  setup(def) {
    def.props.define({
      variant: {
        type: 'enum',
        options: ['regular', 'prominent', 'destructive'],
        empty: 'fallback',
      },
      size: { type: 'enum', options: ['sm', 'default', 'lg', 'icon'], empty: 'fallback' },
      wrap: { type: 'boolean', empty: 'fallback' },
      disabled: { type: 'boolean', empty: 'fallback' },
      material: { type: 'enum', options: ['auto', 'opaque'], empty: 'fallback' },
    });
    def.props.setDefaults({
      variant: 'regular',
      size: 'default',
      wrap: false,
      disabled: false,
      material: 'auto',
    });
    const inherited = asButton();
    const state = inherited.stateHandles;
    if (!state) throw new Error('[liquid-glass-button] Base Button states are required.');
    const { hovered, pressed, focusVisible, disabled } = state;

    def.feedback.style.use(
      tw(
        'inline-flex box-border shrink-0 items-center justify-center rounded-full border border-border font-medium select-none cursor-pointer shadow-sm'
      )
    );
    def.rule({
      when: (w) => w.meta('preference.reducedMotion').eq('no-preference'),
      // Material withdrawal must restore opaque fallback without interpolating
      // the provider-owned transparent background through unreadable alpha.
      intent: (i) => i.feedback.style.use(tw('transition-shadow duration-150')),
    });
    def.rule({
      when: (w) => w.not(w.meta('preference.reducedMotion').eq('no-preference')),
      intent: (i) => i.feedback.style.use(tw('transition-none')),
    });
    (Object.keys(SIZES) as LiquidGlassButtonSize[]).forEach((size) => {
      def.rule({
        when: (w) => w.prop('size').eq(size),
        intent: (i) => i.feedback.style.use(tw(SIZES[size])),
      });
    });
    def.rule({
      when: (w) => w.any(w.prop('wrap').eq(false), w.prop('size').eq('icon')),
      intent: (i) => i.feedback.style.use(tw('whitespace-nowrap')),
    });
    def.rule({
      when: (w) => w.all(w.prop('wrap').eq(true), w.not(w.prop('size').eq('icon'))),
      intent: (i) =>
        i.feedback.style.use(tw('whitespace-normal min-w-0 max-w-full wrap-anywhere text-center')),
    });
    (Object.keys(FILLS) as LiquidGlassButtonVariant[]).forEach((variant) => {
      def.rule({
        when: (w) => w.prop('variant').eq(variant),
        intent: (i) => i.feedback.style.use(tw(FILLS[variant])),
      });
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(hovered).eq(true),
          w.state(pressed).eq(false),
          w.state(disabled).eq(false),
          w.state(focusVisible).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw(COMMAND_HOVER)),
    });
    def.feedback.material.declare({
      version: 2,
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    });
    // Prominence selects only style-owned tint; Base remains the sole input owner.
    for (const variant of ['regular', 'prominent', 'destructive'] as const)
      for (const phase of [false, true]) {
        def.rule({
          when: (w) =>
            w.all(
              w.prop('variant').eq(variant),
              w.prop('material').eq('auto'),
              w.state(disabled).eq(false),
              w.state(pressed).eq(phase)
            ),
          intent: (i) =>
            i.feedback.material.use({
              intent: 'liquid-glass',
              variant: 'regular',
              ...(variant !== 'regular' ? { tint: 'style-fill' as const } : {}),
              deformation: { kind: 'press', phase: phase ? 'pressed' : 'rest', contact: 'pointer' },
            }),
        });
      }
    def.rule({
      when: (w) => w.all(w.state(pressed).eq(true), w.state(disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw(COMMAND_PRESS)),
    });
    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS)),
    });
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      // Disabling withdraws interactive elevation immediately, including an
      // in-flight enabled shadow transition.
      intent: (i) => i.feedback.style.use(tw(COMMAND_DISABLED, 'transition-none')),
    });
    return inherited.render;
  },
});
