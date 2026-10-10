import { definePrototype, tw } from '@proto.ui/core';
import { asFieldsetLegend } from '@proto.ui/prototypes-base/fieldset';
export default definePrototype({
  name: 'liquid-glass-fieldset-legend',
  setup(def) {
    const inherited = asFieldsetLegend();
    def.feedback.style.use(tw('text-base font-semibold'));
    return inherited.render;
  },
});
