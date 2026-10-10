import { definePrototype, tw } from '@proto.ui/core';
import { asMeterLabel } from '@proto.ui/prototypes-base/meter';
export default definePrototype({
  name: 'shadcn-meter-label',
  setup(def) {
    const inherited = asMeterLabel();
    def.feedback.style.use(tw('text-sm font-medium'));
    return inherited.render;
  },
});
