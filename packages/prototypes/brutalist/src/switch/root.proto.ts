import { definePrototype } from '@proto.ui/core';
import { asSwitchRoot } from '@proto.ui/prototypes-base/switch';
import type { BrutalistSwitchRootProps, BrutalistSwitchRootExposes } from './types';
import { setupSwitchRootVisual } from './root-visual';
export default definePrototype<BrutalistSwitchRootProps, BrutalistSwitchRootExposes>({
  name: 'brutalist-switch-root',
  setup(def) {
    const control = asSwitchRoot();
    if (!control.stateHandles)
      throw new Error('[brutalist-switch-root] Missing Base Switch facts.');
    setupSwitchRootVisual(def, control.stateHandles);
    return control.render;
  },
});
