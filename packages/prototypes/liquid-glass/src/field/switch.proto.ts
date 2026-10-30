import { definePrototype } from '@proto.ui/core';
import {
  asFieldSwitch,
  type FieldSwitchExposes,
  type FieldSwitchProps,
} from '@proto.ui/prototypes-base/field';
import { setupLiquidSwitchRootVisual } from '../switch/root-visual';
import type { LiquidGlassSwitchRootProps } from '../switch/types';

export type LiquidGlassFieldSwitchProps = FieldSwitchProps & LiquidGlassSwitchRootProps;
export type LiquidGlassFieldSwitchExposes = FieldSwitchExposes;

// Use the exact public semantic composition. An ordinary Switch substitution
// would lose the optional Field control lease, policies, reporting and label
// pairing; no second Switch or Field hook is installed for presentation.
export default definePrototype<LiquidGlassFieldSwitchProps, LiquidGlassFieldSwitchExposes>({
  name: 'liquid-glass-field-switch',
  modules: asFieldSwitch.modules,
  setup(def) {
    const inherited = asFieldSwitch();
    const state = inherited.stateHandles;
    const binding = inherited.getAsHookHandle!('as-optional-field-control');
    if (!state || !binding)
      throw new Error('[liquid-glass-field-switch] Base Switch and Field facts are required.');
    setupLiquidSwitchRootVisual(def, state, binding.state.invalid);
    return inherited.render;
  },
});
