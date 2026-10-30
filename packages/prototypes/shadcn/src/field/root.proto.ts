import { definePrototype } from '@proto.ui/core';
import { asFieldRoot, type FieldRootExposes } from '@proto.ui/prototypes-base/field';
import type { ShadcnFieldRootProps } from './types';
import { setupFieldRootVisual } from './visual';
export default definePrototype<ShadcnFieldRootProps, FieldRootExposes>({
  name: 'shadcn-field-root',
  modules: asFieldRoot.modules,
  setup(def) {
    const inherited = asFieldRoot();
    setupFieldRootVisual(def, inherited.stateHandles!.invalid);
    return inherited.render;
  },
});
