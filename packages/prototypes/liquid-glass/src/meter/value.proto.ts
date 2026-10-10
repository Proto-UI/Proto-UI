import { definePrototype, tw } from '@proto.ui/core';
import { asMeterValue } from '@proto.ui/prototypes-base/meter';
export default definePrototype({
  name: 'liquid-glass-meter-value',
  setup(def) {
    const inherited = asMeterValue();
    def.feedback.style.use(tw('text-sm tabular-nums text-muted-foreground'));
    return inherited.render;
  },
});
