import { definePrototype, tw } from '@proto.ui/core';
import { asSelectSeparator } from '@proto.ui/prototypes-base/select';
import type { LiquidGlassSelectSeparatorProps, LiquidGlassSelectSeparatorExposes } from './types';

// Decorative hidden part; the caller must commit an empty view per Base policy.
export default definePrototype<LiquidGlassSelectSeparatorProps, LiquidGlassSelectSeparatorExposes>({
  name: 'liquid-glass-select-separator',
  setup(def) {
    const inherited = asSelectSeparator();
    def.feedback.style.use(tw('mx-2 my-1 h-px bg-border'));
    return inherited.render;
  },
});
