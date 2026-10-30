import { definePrototype } from '@proto.ui/core';
import { asFormReset, type FormActionExposes } from '@proto.ui/prototypes-base/form';
import type { ShadcnFormActionProps } from './types';
import { setupFormActionVisual } from './action-visual';

export default definePrototype<ShadcnFormActionProps, FormActionExposes>({
  name: 'shadcn-form-reset',
  modules: asFormReset.modules,
  setup(def) {
    const inherited = asFormReset();
    setupFormActionVisual(def, inherited.stateHandles!, 'reset');
    return inherited.render;
  },
});
