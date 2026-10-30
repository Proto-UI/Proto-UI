import { definePrototype } from '@proto.ui/core';
import {
  asFormReset,
  type FormActionExposes,
  type FormActionProps,
} from '@proto.ui/prototypes-base/form';
import { setupFormActionVisual } from './action-visual';
// Passive bootstrap-2-3-2 Button paint; Base Form remains the sole action owner.
export default definePrototype<FormActionProps, FormActionExposes>({
  name: 'bootstrap-2-3-2-form-reset',
  setup(def) {
    const inherited = asFormReset();
    setupFormActionVisual(def, inherited.stateHandles!);
    return inherited.render;
  },
});
