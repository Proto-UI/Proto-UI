import { definePrototype } from '@proto.ui/core';
import {
  asFieldSwitch,
  type FieldSwitchProps,
  type FieldSwitchExposes,
} from '@proto.ui/prototypes-base/field';
import { setupSwitchRootVisual } from '../switch/root-visual';
import type { ShadcnSwitchRootProps, ShadcnSwitchRootExposes } from '../switch/types';
export type ShadcnFieldSwitchProps = FieldSwitchProps & ShadcnSwitchRootProps;
export type ShadcnFieldSwitchExposes = FieldSwitchExposes & ShadcnSwitchRootExposes;
export default definePrototype<ShadcnFieldSwitchProps, ShadcnFieldSwitchExposes>({
  name: 'shadcn-field-switch',
  modules: asFieldSwitch.modules,
  setup(def) {
    const control = asFieldSwitch();
    const binding = control.getAsHookHandle!('as-optional-field-control');
    if (!control.stateHandles || !binding)
      throw new Error('[shadcn-field-switch] Missing Base/Field facts');
    setupSwitchRootVisual(def, control.stateHandles, binding.state.invalid);
    return control.render;
  },
});
