import { definePrototype } from '@proto.ui/core';
import { asSelectTrigger } from '@proto.ui/prototypes-base/select';
import type { LiquidGlassSelectTriggerProps, LiquidGlassSelectTriggerExposes } from './types';
import { setupSelectTriggerVisual } from './trigger-visual';

export default definePrototype<LiquidGlassSelectTriggerProps, LiquidGlassSelectTriggerExposes>({
  name: 'liquid-glass-select-trigger',
  setup(def) {
    const state = asSelectTrigger().stateHandles;
    if (!state)
      throw new Error('[liquid-glass-select-trigger] Required Base state handles are missing.');
    return setupSelectTriggerVisual(def, state);
  },
});
