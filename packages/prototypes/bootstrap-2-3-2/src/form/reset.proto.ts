import { definePrototype } from '@proto.ui/core';
import { asFormReset, type FormActionExposes } from '@proto.ui/prototypes-base/form';
import { setupFormActionVisual, type BootstrapFormActionProps } from './action-visual';

// Passive bootstrap-2-3-2 Button paint; Base Form remains the sole action owner.
export default definePrototype<BootstrapFormActionProps, FormActionExposes>({
  name: 'bootstrap-2-3-2-form-reset',
  modules: asFormReset.modules,
  setup(def) {
    const inherited = asFormReset();
    setupFormActionVisual(def, inherited.stateHandles!, 'default');
    return inherited.render;
  },
});
