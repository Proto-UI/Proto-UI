import { definePrototype } from '@proto.ui/core';
import { asSwitchRoot } from '@proto.ui/prototypes-base/switch';
import { setupSwitchRootVisual } from './root-visual';
import type { ShadcnSwitchRootExposes, ShadcnSwitchRootProps } from './types';
export default definePrototype<ShadcnSwitchRootProps, ShadcnSwitchRootExposes>({
  name: 'shadcn-switch-root',
  modules: asSwitchRoot.modules,
  setup(def) {
    const state = asSwitchRoot().stateHandles;
    if (!state) throw new Error('[shadcn-switch-root] Missing Base Switch facts');
    setupSwitchRootVisual(def, state);
  },
});
