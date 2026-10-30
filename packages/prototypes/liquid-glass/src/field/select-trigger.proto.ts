import { definePrototype } from '@proto.ui/core';
import {
  asFieldSelectTrigger,
  type FieldSelectTriggerProps,
  type FieldSelectTriggerExposes,
  type FieldSelectTriggerAsHookContract,
} from '@proto.ui/prototypes-base/field';
import { setupSelectTriggerVisual } from '../select/trigger-visual';

export type LiquidGlassFieldSelectTriggerProps = FieldSelectTriggerProps;
export type LiquidGlassFieldSelectTriggerExposes = FieldSelectTriggerExposes;
export type LiquidGlassFieldSelectTriggerAsHookContract = FieldSelectTriggerAsHookContract;

/** Field semantics and ordinary Select share both the Base request owner and the visual projection. */
export default definePrototype<
  LiquidGlassFieldSelectTriggerProps,
  LiquidGlassFieldSelectTriggerExposes
>({
  name: 'liquid-glass-field-select-trigger',
  modules: asFieldSelectTrigger.modules,
  setup(def) {
    const trigger = asFieldSelectTrigger();
    const binding = trigger.getAsHookHandle?.('as-optional-field-control');
    if (!trigger.stateHandles || !binding?.state?.invalid)
      throw new Error('[liquid-glass-field-select-trigger] Required Base/Field facts are missing.');
    return setupSelectTriggerVisual(def, trigger.stateHandles, binding.state.invalid);
  },
});
