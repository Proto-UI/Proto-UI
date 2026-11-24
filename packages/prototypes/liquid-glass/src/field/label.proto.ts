import { definePrototype, tw } from '@proto.ui/core';
import {
  asFieldLabel,
  type FieldLabelProps,
  type FieldLabelExposes,
} from '@proto.ui/prototypes-base/field';

export default definePrototype<FieldLabelProps, FieldLabelExposes>({
  name: 'liquid-glass-field-label',
  modules: asFieldLabel.modules,
  setup(def) {
    const inherited = asFieldLabel();
    def.feedback.style.use(
      tw('block px-1 text-base font-medium leading-normal select-none break-words')
    );
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-not-allowed')),
    });
    return inherited.render;
  },
});
