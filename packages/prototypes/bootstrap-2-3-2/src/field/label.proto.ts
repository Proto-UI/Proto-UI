import { definePrototype, tw } from '@proto.ui/core';
import {
  asFieldLabel,
  type FieldLabelProps,
  type FieldLabelExposes,
} from '@proto.ui/prototypes-base/field';

export default definePrototype<FieldLabelProps, FieldLabelExposes>({
  name: 'bootstrap-2-3-2-field-label',
  modules: asFieldLabel.modules,
  setup(def) {
    const inherited = asFieldLabel();
    def.feedback.style.use(
      tw(
        'block mb-[5px] text-[14px] font-normal leading-[20px] text-inherit select-none break-words'
      )
    );
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-65 cursor-not-allowed')),
    });
    return inherited.render;
  },
});
