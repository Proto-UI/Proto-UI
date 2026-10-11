import { definePrototype, tw } from '@proto.ui/core';
import { asSelectValue } from '@proto.ui/prototypes-base/select';
import type { LiquidGlassSelectValueProps, LiquidGlassSelectValueExposes } from './types';

export default definePrototype<LiquidGlassSelectValueProps, LiquidGlassSelectValueExposes>({
  name: 'liquid-glass-select-value',
  setup(def) {
    const state = asSelectValue().stateHandles;
    if (!state)
      throw new Error('[liquid-glass-select-value] Required Base state handles are missing.');
    const { displayValue } = state;
    // Grow with long/translated labels; the enclosing Trigger owns pointer hits.
    def.feedback.style.use(tw('min-w-0 flex-1 whitespace-normal wrap-anywhere text-start'));
    return () => (displayValue.get() ? [displayValue.get()] : null);
  },
});
