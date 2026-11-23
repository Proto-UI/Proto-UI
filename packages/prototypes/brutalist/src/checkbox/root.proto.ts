import { definePrototype } from '@proto.ui/core';
import { asCheckboxRoot } from '@proto.ui/prototypes-base/checkbox';
import type { BrutalistCheckboxRootExposes, BrutalistCheckboxRootProps } from './types';
import { setupCheckboxRootVisual } from './root-visual';
export default definePrototype<BrutalistCheckboxRootProps, BrutalistCheckboxRootExposes>({
  name: 'brutalist-checkbox-root',
  setup(def) {
    const checkbox = asCheckboxRoot();
    if (!checkbox.stateHandles)
      throw new Error('[brutalist-checkbox-root] Missing Base Checkbox facts.');
    setupCheckboxRootVisual(def, checkbox.stateHandles);
    return checkbox.render;
  },
});
