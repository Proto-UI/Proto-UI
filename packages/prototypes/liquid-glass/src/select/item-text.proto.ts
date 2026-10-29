import { definePrototype, tw } from '@proto.ui/core';
import { asSelectItemText } from '@proto.ui/prototypes-base/select';
import type { LiquidGlassSelectItemTextProps } from './types';

// Alignment's inline geometry target: the actual visible label box inside Item.
export default definePrototype<LiquidGlassSelectItemTextProps>({
  name: 'liquid-glass-select-item-text',
  setup(def) {
    asSelectItemText();
    def.feedback.style.use(tw('min-w-0 whitespace-normal wrap-anywhere'));
    return (renderer) => [renderer.r.slot()];
  },
});
