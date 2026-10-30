import { definePrototype } from '@proto.ui/core';
import { asSelectTrigger } from '@proto.ui/prototypes-base/select';
import type { Bootstrap232SelectTriggerProps, Bootstrap232SelectTriggerExposes } from './types';
import { setupSelectTriggerVisual } from './trigger-visual';

export default definePrototype<Bootstrap232SelectTriggerProps, Bootstrap232SelectTriggerExposes>({
  name: 'bootstrap-2-3-2-select-trigger',
  setup(def) {
    const state = asSelectTrigger().stateHandles;
    if (!state)
      throw new Error('[bootstrap-2-3-2-select-trigger] Required Base state handles are missing.');
    return setupSelectTriggerVisual(def, state);
  },
});
