import { definePrototype } from '@proto.ui/core';
import {
  asFormSubmit,
  type FormActionExposes,
  type FormActionProps,
} from '@proto.ui/prototypes-base/form';
import { setupButtonVisual } from '../button/visual';
// Passive bootstrap-2-3-2 Button paint; Base Form remains the sole action owner.
export default definePrototype<FormActionProps, FormActionExposes>({
  name: 'bootstrap-2-3-2-form-submit',
  setup(def) {
    const inherited = asFormSubmit();
    setupButtonVisual(def, inherited.stateHandles!, 'primary');
    return inherited.render;
  },
});
