import { definePrototype, tw } from '@proto.ui/core';
import { asCheckboxIndicator } from '@proto.ui/prototypes-base/checkbox';
import { checkboxGlyph } from './indicator-paint';
import type {
  LiquidGlassCheckboxIndicatorExposes,
  LiquidGlassCheckboxIndicatorProps,
} from './types';

// Passive indicator: it renders the Root-published checked/mixed marks only.
// No material owner, focus target, event target or accessibility control.
export default definePrototype<
  LiquidGlassCheckboxIndicatorProps,
  LiquidGlassCheckboxIndicatorExposes
>({
  name: 'liquid-glass-checkbox-indicator',
  setup(def) {
    const inherited = asCheckboxIndicator();
    const state = inherited.stateHandles;
    if (!state)
      throw new Error(
        '[liquid-glass-checkbox-indicator] Base Checkbox Indicator states are required.'
      );
    const { checked, indeterminate } = state;
    // currentColor inherits the Root's state-owned foreground (primary-foreground
    // while filled), so the mark stays readable in every governed state pair.
    def.feedback.style.use(tw('flex size-4 shrink-0 items-center justify-center'));
    const glyph = checkboxGlyph(def, { checked, indeterminate });
    return (renderer) => [renderer.r.slot(), glyph(renderer)];
  },
});
