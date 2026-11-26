import {
  COMMAND_HOVER,
  COMMAND_PRESS,
  COMMAND_FOCUS,
  COMMAND_DISABLED,
} from '../interactive-surface';
import { definePrototype, tw } from '@proto.ui/core';
import { asCollapsibleTrigger } from '@proto.ui/prototypes-base/collapsible';
import type {
  LiquidGlassCollapsibleTriggerProps,
  LiquidGlassCollapsibleTriggerExposes,
} from './types';

// P-LIQUID-GLASS-COLLAPSIBLE-TRIGGER-BASE-INHERITANCE: Base is the only semantic owner.
// Explicit optical intent uses the shared material owner; never substitute adaptive CSS blur.
const collapsibleTrigger = definePrototype<
  LiquidGlassCollapsibleTriggerProps,
  LiquidGlassCollapsibleTriggerExposes
>({
  name: 'liquid-glass-collapsible-trigger',
  modules: asCollapsibleTrigger.modules,
  setup(def) {
    const inherited = asCollapsibleTrigger();
    const state = inherited.stateHandles;
    def.props.define({
      variant: { type: 'enum', options: ['regular', 'prominent'], empty: 'fallback' },
      material: { type: 'enum', options: ['auto', 'opaque'], empty: 'fallback' },
    });
    def.props.setDefaults({ variant: 'regular', material: 'auto' });
    if (!state) throw new Error('[liquid-glass-collapsible-trigger] Missing Base state handles.');
    const { expanded, hovered, pressed, focusVisible, disabled } = state;

    // P-LIQUID-GLASS-COLLAPSIBLE-TRIGGER-MATERIAL-INTENT: one owned slot,
    // complete opaque style fallback, and no adaptive/native-blur substitution.
    def.feedback.material.declare({
      version: 2,
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    });
    for (const isPressed of [false, true]) {
      def.rule({
        when: (w) =>
          w.all(
            w.state(pressed).eq(isPressed),
            w.state(disabled).eq(false),
            w.prop('material').eq('auto'),
            w.prop('variant').eq('regular')
          ),
        intent: (i) =>
          i.feedback.material.use({
            intent: 'liquid-glass',
            deformation: {
              kind: 'press',
              phase: isPressed ? 'pressed' : 'rest',
              contact: 'pointer',
            },
          }),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.state(pressed).eq(isPressed),
            w.state(disabled).eq(false),
            w.prop('material').eq('auto'),
            w.prop('variant').eq('prominent')
          ),
        intent: (i) =>
          i.feedback.material.use({
            intent: 'liquid-glass',
            tint: 'style-fill',
            deformation: {
              kind: 'press',
              phase: isPressed ? 'pressed' : 'rest',
              contact: 'pointer',
            },
          }),
      });
    }

    // P-LIQUID-GLASS-COLLAPSIBLE-TRIGGER-VISUAL-SAFETY: no fixed width/height or clipped long label.
    // Optical withdrawal must expose the final opaque pair immediately; a
    // color transition would interpolate through transparent fallback paint.
    def.feedback.style.use(
      tw(
        'min-w-0 max-w-full text-foreground wrap-anywhere whitespace-break-spaces text-left cursor-pointer select-none inline-flex items-center justify-start gap-2 rounded-xl border border-border bg-secondary px-5 py-3 text-sm font-medium shadow-sm transition-shadow'
      )
    );
    def.rule({
      when: (w) => w.prop('variant').eq('prominent'),
      intent: (i) =>
        i.feedback.style.use(tw('border-primary bg-primary text-primary-foreground shadow-md')),
    });
    def.rule({
      when: (w) => w.all(w.state(expanded).eq(true), w.state(disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw('font-semibold')),
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
      intent: (i) => i.feedback.style.use(tw(COMMAND_DISABLED)),
    });
    return inherited.render;
  },
});

export default collapsibleTrigger;
