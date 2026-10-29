import { definePrototype } from '@proto.ui/core';
import { asSelectGroup } from '@proto.ui/prototypes-base/select';
import type { LiquidGlassSelectGroupProps, LiquidGlassSelectGroupExposes } from './types';

// Semantic-only grouping: Base retains naming scope and collection ownership.
export default definePrototype<LiquidGlassSelectGroupProps, LiquidGlassSelectGroupExposes>({
  name: 'liquid-glass-select-group',
  setup() {
    asSelectGroup();
    return (renderer) => [renderer.r.slot()];
  },
});
