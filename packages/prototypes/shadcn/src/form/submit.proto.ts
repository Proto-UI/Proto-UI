import { definePrototype } from '@proto.ui/core';
import { asFormSubmit, type FormActionExposes } from '@proto.ui/prototypes-base/form';
import type { ShadcnFormActionProps } from './types';
import { setupFormActionVisual } from './action-visual';

export default definePrototype<ShadcnFormActionProps, FormActionExposes>({
  name: 'shadcn-form-submit',
  modules: asFormSubmit.modules,
  setup(def) {
    const inherited = asFormSubmit();
    setupFormActionVisual(def, inherited.stateHandles!, 'submit');
    return inherited.render;
  },
});
