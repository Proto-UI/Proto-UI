import { definePrototype, tw } from '@proto.ui/core';
import { asMeterRoot } from '@proto.ui/prototypes-base/meter';
export default definePrototype({
  name: 'liquid-glass-meter-root',
  setup(def) {
    const inherited = asMeterRoot();
    def.feedback.style.use(tw('flex w-full min-w-0 flex-col gap-3 text-foreground'));
    return inherited.render;
  },
});
