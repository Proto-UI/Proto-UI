import { definePrototype, tw } from '@proto.ui/core';
import { asSelectLabel } from '@proto.ui/prototypes-base/select';
import type { LiquidGlassSelectLabelProps, LiquidGlassSelectLabelExposes } from './types';

// Group-local accessible name only; family typography mirrors the Dropdown Label.
export default definePrototype<LiquidGlassSelectLabelProps, LiquidGlassSelectLabelExposes>({
  name: 'liquid-glass-select-label',
  setup(def) {
    asSelectLabel();
    def.feedback.style.use(tw('px-3 py-1 text-xs font-medium text-muted-foreground'));
    return (renderer) => [renderer.r.slot()];
  },
});
