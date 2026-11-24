import type {
  NumberFieldLabelExposes,
  NumberFieldPartProps,
} from '@proto.ui/prototypes-base/number-field';
import { definePrototype, tw } from '@proto.ui/core';
import { asNumberFieldLabel } from '@proto.ui/prototypes-base/number-field';
export default definePrototype<NumberFieldPartProps, NumberFieldLabelExposes>({
  name: 'bootstrap-2-3-2-number-field-label',
  modules: asNumberFieldLabel.modules,
  setup(def) {
    const inherited = asNumberFieldLabel();
    def.feedback.style.use(
      tw('block w-full mb-[5px] font-sans text-[14px] font-normal leading-[20px]')
    );
    return inherited.render;
  },
});
