import { COMMAND_FOCUS, COMMAND_HOVER, COMMAND_PRESS } from '../interactive-surface';
import { definePrototype, tw } from '@proto.ui/core';
import { asRadioGroupItem } from '@proto.ui/prototypes-base/radio-group';
import type { LiquidGlassRadioGroupItemExposes, LiquidGlassRadioGroupItemProps } from './types';

// Proto design-language radio control guided by public Apple HIG selection
// controls, not an Apple-native parity claim. Base remains the sole owner of
// value requests, roving focus, activation, cancellation and disabled; the
// Indicator keeps the passively rendered dot.
export default definePrototype<LiquidGlassRadioGroupItemProps, LiquidGlassRadioGroupItemExposes>({
  name: 'liquid-glass-radio-group-item',
  setup(def) {
    def.props.define({
      material: { type: 'enum', options: ['auto', 'opaque'], empty: 'fallback' },
    });
    def.props.setDefaults({ material: 'auto' });
    const inherited = asRadioGroupItem();
    const state = inherited.stateHandles;
    if (!state)
      throw new Error('[liquid-glass-radio-group-item] Base Radio Item states are required.');
    const { checked, disabled, hovered, pressed, focusVisible } = state;

    // A compact circle: checked takes the governed primary fill and the
    // Indicator's currentColor dot supplies the non-color selected mark.
    def.feedback.style.use(
      tw(
        'inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-sm outline-none select-none cursor-pointer'
      )
    );
    def.rule({
      when: (w) => w.state(checked).eq(true),
      intent: (i) => i.feedback.style.use(tw('border-primary bg-primary text-primary-foreground')),
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
    def.feedback.material.declare({
      version: 2,
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    });
    for (const selected of [false, true])
      for (const phase of [false, true])
        def.rule({
          when: (w) =>
            w.all(
              w.prop('material').eq('auto'),
              w.state(disabled).eq(false),
              w.state(checked).eq(selected),
              w.state(pressed).eq(phase)
            ),
          intent: (i) =>
            i.feedback.material.use({
              intent: 'liquid-glass',
              variant: 'regular',
              ...(selected ? { tint: 'style-fill' as const } : {}),
              deformation: { kind: 'press', phase: phase ? 'pressed' : 'rest', contact: 'pointer' },
            }),
        });
    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS)),
    });
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      // Keep the same-state fill/foreground opaque, including selected marks.
      intent: (i) => i.feedback.style.use(tw('cursor-not-allowed shadow-none')),
    });
    return inherited.render;
  },
});
