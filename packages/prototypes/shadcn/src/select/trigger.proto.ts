import { definePrototype } from '@proto.ui/core';
import { asSelectTrigger } from '@proto.ui/prototypes-base/select';
import type { ShadcnSelectTriggerProps, ShadcnSelectTriggerExposes } from './types';
import { setupSelectTriggerVisual } from './trigger-visual';
export default definePrototype<ShadcnSelectTriggerProps, ShadcnSelectTriggerExposes>({
  name: 'shadcn-select-trigger',
  setup(def) {
    const state = asSelectTrigger().stateHandles;
    if (!state) throw new Error('[shadcn-select-trigger] Missing Base command facts');
    return setupSelectTriggerVisual(def, state);
  },
});
