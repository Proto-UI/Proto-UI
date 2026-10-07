import { definePrototype, tw } from '@proto.ui/core';
import {
  asFieldLabel,
  type FieldLabelProps,
  type FieldLabelExposes,
} from '@proto.ui/prototypes-base/field';
export default definePrototype<FieldLabelProps, FieldLabelExposes>({
  name: 'shadcn-field-label',
  setup(def) {
    const inherited = asFieldLabel();
    def.feedback.style.use(tw('block text-sm font-medium leading-normal break-words'));
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50')),
    });
    return inherited.render;
  },
});
