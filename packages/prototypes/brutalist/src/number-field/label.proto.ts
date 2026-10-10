import type { NumberFieldLabelExposes } from '@proto.ui/prototypes-base/number-field';
import type { NumberFieldPartProps } from '@proto.ui/prototypes-base/number-field';
import { definePrototype, tw } from '@proto.ui/core';
import { asNumberFieldLabel } from '@proto.ui/prototypes-base/number-field';
export default definePrototype<NumberFieldPartProps, NumberFieldLabelExposes>({
  name: 'brutalist-number-field-label',
  setup(def) {
    const inherited = asNumberFieldLabel();
    def.feedback.style.use(tw('block w-full text-sm font-bold'));
    return inherited.render;
  },
});
