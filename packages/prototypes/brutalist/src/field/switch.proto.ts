import { definePrototype } from '@proto.ui/core';
import {
  asFieldSwitch,
  type FieldSwitchProps,
  type FieldSwitchExposes,
} from '@proto.ui/prototypes-base/field';
import { setupSwitchRootVisual } from '../switch/root-visual';
import type { BrutalistSwitchRootProps, BrutalistSwitchRootExposes } from '../switch/types';
export type BrutalistFieldSwitchProps = FieldSwitchProps & BrutalistSwitchRootProps;
export type BrutalistFieldSwitchExposes = FieldSwitchExposes & BrutalistSwitchRootExposes;
export default definePrototype<BrutalistFieldSwitchProps, BrutalistFieldSwitchExposes>({
  name: 'brutalist-field-switch',
  modules: asFieldSwitch.modules,
  setup(def) {
    const control = asFieldSwitch();
    const binding = control.getAsHookHandle!('as-optional-field-control');
    if (!control.stateHandles || !binding)
      throw new Error('[brutalist-field-switch] Missing Base/Field facts.');
    setupSwitchRootVisual(def, control.stateHandles, binding.state.invalid);
    return control.render;
  },
});
