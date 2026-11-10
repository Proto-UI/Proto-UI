import { definePrototype, tw } from '@proto.ui/core';
import {
  asFieldSelectTrigger,
  type FieldSelectTriggerAsHookContract,
  type FieldSelectTriggerExposes,
  type FieldSelectTriggerProps,
} from '@proto.ui/prototypes-base/field';
import type { Bootstrap232SelectTriggerProps } from '../select/types';
import { setupSelectTriggerVisual } from '../select/trigger-visual';
import { bootstrapLightControlInvalidPaint } from '../input/visual';

export type Bootstrap232FieldSelectTriggerProps = FieldSelectTriggerProps &
  Bootstrap232SelectTriggerProps;
export type Bootstrap232FieldSelectTriggerExposes = FieldSelectTriggerExposes;
export type Bootstrap232FieldSelectTriggerAsHookContract = FieldSelectTriggerAsHookContract;

// The optional Field composition reuses the same Select request owner and the
// same-family button-dropdown paint; the Base Field binding alone owns
// invalid/pending and FIELD_LABEL_PAIR relationships.
export default definePrototype<
  Bootstrap232FieldSelectTriggerProps,
  Bootstrap232FieldSelectTriggerExposes
>({
  name: 'bootstrap-2-3-2-field-select-trigger',
  modules: asFieldSelectTrigger.modules,
  setup(def) {
    const trigger = asFieldSelectTrigger();
    const binding = trigger.getAsHookHandle!('as-optional-field-control');
    if (!trigger.stateHandles || !binding)
      throw new Error('[bootstrap-2-3-2-field-select-trigger] Missing Base/Field facts');
    // Keep this Rule beside its existing public Field binding so the family
    // source collector can retain the emitted invalid selector.
    def.rule({
      when: (w) => w.state(binding.state.invalid).eq(true),
      intent: (i) => i.feedback.style.use(tw(bootstrapLightControlInvalidPaint)),
    });
    return setupSelectTriggerVisual(def, trigger.stateHandles);
  },
});
