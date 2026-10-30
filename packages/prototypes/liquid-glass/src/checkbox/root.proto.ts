import { COMMAND_FOCUS, COMMAND_HOVER, COMMAND_PRESS } from '../interactive-surface';
import { definePrototype, tw } from '@proto.ui/core';
import { asCheckboxRoot } from '@proto.ui/prototypes-base/checkbox';
import type { LiquidGlassCheckboxRootExposes, LiquidGlassCheckboxRootProps } from './types';

// Proto design-language projection guided by public Apple HIG checkmark
// selection and controlled optical material, not an Apple-native checkbox
// implementation. Base remains the only checked/mixed, activation, focus,
// cancellation and disabled owner; the Indicator stays a passive context part.
export default definePrototype<LiquidGlassCheckboxRootProps, LiquidGlassCheckboxRootExposes>({
  name: 'liquid-glass-checkbox-root',
  setup(def) {
    def.props.define({
      material: { type: 'enum', options: ['auto', 'opaque'], empty: 'fallback' },
    });
    def.props.setDefaults({ material: 'auto' });
    const inherited = asCheckboxRoot();
    const state = inherited.stateHandles;
    if (!state) throw new Error('[liquid-glass-checkbox-root] Base Checkbox states are required.');
    const { checked, indeterminate, disabled, hovered, pressed, focusVisible } = state;

    // A compact square control: checked/mixed share the governed primary fill
    // and the Indicator's currentColor mark supplies the non-color difference.
    def.feedback.style.use(
      tw(
        'inline-flex size-5 shrink-0 items-center justify-center rounded-[6px] border border-border bg-background text-foreground shadow-sm outline-none select-none cursor-pointer'
      )
    );
    def.rule({
      when: (w) => w.any(w.state(checked).eq(true), w.state(indeterminate).eq(true)),
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
    // Selection requests a style-fill tint; the same-state opaque pair above
    // remains the complete readable fallback for explicit opaque, disabled
    // and unsupported hosts.
    for (const selected of [false, true])
      for (const phase of [false, true])
        def.rule({
          when: (w) =>
            w.all(
              w.prop('material').eq('auto'),
              w.state(disabled).eq(false),
              selected
                ? w.any(w.state(checked).eq(true), w.state(indeterminate).eq(true))
                : w.all(w.state(checked).eq(false), w.state(indeterminate).eq(false)),
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
      // Whole-host opacity would make the fallback depend on the backdrop.
      intent: (i) => i.feedback.style.use(tw('cursor-not-allowed shadow-none')),
    });
    // The inherited render is preserved; the Root does not paint its own glyph.
    return inherited.render;
  },
});
