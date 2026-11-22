import { definePrototype } from '@proto.ui/core';
import { asRadioGroupRoot } from '@proto.ui/prototypes-base/radio-group';
import type { BrutalistRadioGroupRootProps, BrutalistRadioGroupRootExposes } from './types';
import { setupRadioGroupRootVisual } from './root-visual';
export default definePrototype<BrutalistRadioGroupRootProps, BrutalistRadioGroupRootExposes>({
  name: 'brutalist-radio-group-root',
  setup(def) {
    const group = asRadioGroupRoot();
    setupRadioGroupRootVisual(def);
    return group.render;
  },
});
