import { definePrototype, tw } from '@proto.ui/core';
import { asNumberFieldLabel } from '@proto.ui/prototypes-base/number-field';
export default definePrototype({
  name: 'shadcn-number-field-label',
  setup(def) {
    const inherited = asNumberFieldLabel();
    def.feedback.style.use(tw('block w-full text-sm font-medium'));
    return inherited.render;
  },
});
