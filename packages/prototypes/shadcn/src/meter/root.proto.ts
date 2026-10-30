import { definePrototype, tw } from '@proto.ui/core';
import { type MeterRootExposes, asMeterRoot } from '@proto.ui/prototypes-base/meter';
import { setupShadcnStyleScope } from '../style-scope';
import type { ShadcnMeterRootProps } from './types';
export default definePrototype<ShadcnMeterRootProps, MeterRootExposes>({
  name: 'shadcn-meter-root',
  modules: asMeterRoot.modules,
  setup(def) {
    const inherited = asMeterRoot();
    setupShadcnStyleScope(def);
    def.feedback.style.use(tw('flex w-full min-w-0 flex-col gap-2 text-foreground'));
    return inherited.render;
  },
});
