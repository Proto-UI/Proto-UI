import { definePrototype } from '@proto.ui/core';
import {
  asFieldSelectTrigger,
  type FieldSelectTriggerProps,
  type FieldSelectTriggerExposes,
} from '@proto.ui/prototypes-base/field';
import type { ShadcnSelectTriggerProps } from '../select/types';
import { setupSelectTriggerVisual } from '../select/trigger-visual';
export type ShadcnFieldSelectTriggerProps = FieldSelectTriggerProps & ShadcnSelectTriggerProps;
export type ShadcnFieldSelectTriggerExposes = FieldSelectTriggerExposes;
/** Field semantics and ordinary Select share both the Base request owner and the visual projection. */
export default definePrototype<ShadcnFieldSelectTriggerProps, ShadcnFieldSelectTriggerExposes>({
  name: 'shadcn-field-select-trigger',
  modules: asFieldSelectTrigger.modules,
  setup(def) {
    const trigger = asFieldSelectTrigger();
    const binding = trigger.getAsHookHandle!('as-optional-field-control');
    if (!trigger.stateHandles || !binding)
      throw new Error('[shadcn-field-select-trigger] Missing Base/Field facts');
    return setupSelectTriggerVisual(def, trigger.stateHandles, binding.state.invalid);
  },
});
