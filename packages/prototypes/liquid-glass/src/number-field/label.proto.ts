import type {
  NumberFieldLabelExposes,
  NumberFieldPartProps,
} from '@proto.ui/prototypes-base/number-field';
import { definePrototype, tw } from '@proto.ui/core';
import { asNumberFieldLabel } from '@proto.ui/prototypes-base/number-field';
export default definePrototype<NumberFieldPartProps, NumberFieldLabelExposes>({
  name: 'liquid-glass-number-field-label',
  modules: asNumberFieldLabel.modules,
  setup(def) {
    const inherited = asNumberFieldLabel();
    def.feedback.style.use(tw('block w-full font-sans text-sm font-medium text-foreground'));
    return inherited.render;
  },
});
