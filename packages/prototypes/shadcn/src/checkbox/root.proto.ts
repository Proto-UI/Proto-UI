import { definePrototype } from '@proto.ui/core';
import { asCheckboxRoot } from '@proto.ui/prototypes-base/checkbox';
import type { ShadcnCheckboxRootExposes, ShadcnCheckboxRootProps } from './types';
import { setupCheckboxRootVisual } from './root-visual';
export default definePrototype<ShadcnCheckboxRootProps, ShadcnCheckboxRootExposes>({
  name: 'shadcn-checkbox-root',
  setup(def) {
    const checkbox = asCheckboxRoot();
    if (!checkbox.stateHandles)
      throw new Error('[shadcn-checkbox-root] Missing Base Checkbox facts.');
    setupCheckboxRootVisual(def, checkbox.stateHandles);
    return checkbox.render;
  },
});
