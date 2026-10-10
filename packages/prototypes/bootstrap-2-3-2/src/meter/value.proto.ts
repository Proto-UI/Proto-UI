import { definePrototype, tw } from '@proto.ui/core';
import { asMeterValue } from '@proto.ui/prototypes-base/meter';
export default definePrototype({
  name: 'bootstrap-2-3-2-meter-value',
  setup(def) {
    const inherited = asMeterValue();
    def.feedback.style.use(tw('text-sm leading-5 tabular-nums text-muted-foreground'));
    return inherited.render;
  },
});
