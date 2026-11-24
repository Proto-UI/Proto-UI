import { definePrototype } from '@proto.ui/core';
import { asFormSubmit, type FormActionExposes } from '@proto.ui/prototypes-base/form';
import { setupFormActionVisual, type BootstrapFormActionProps } from './action-visual';

// Passive bootstrap-2-3-2 Button paint; Base Form remains the sole action owner.
export default definePrototype<BootstrapFormActionProps, FormActionExposes>({
  name: 'bootstrap-2-3-2-form-submit',
  modules: asFormSubmit.modules,
  setup(def) {
    const inherited = asFormSubmit();
    setupFormActionVisual(def, inherited.stateHandles!, 'primary');
    return inherited.render;
  },
});
