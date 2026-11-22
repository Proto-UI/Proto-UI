import { definePrototype } from '@proto.ui/core';
import { asRadioGroupRoot } from '@proto.ui/prototypes-base/radio-group';
import type { ShadcnRadioGroupRootProps, ShadcnRadioGroupRootExposes } from './types';
import { setupRadioGroupRootVisual } from './root-visual';
export default definePrototype<ShadcnRadioGroupRootProps, ShadcnRadioGroupRootExposes>({
  name: 'shadcn-radio-group-root',
  setup(def) {
    const group = asRadioGroupRoot();
    setupRadioGroupRootVisual(def);
    return group.render;
  },
});
