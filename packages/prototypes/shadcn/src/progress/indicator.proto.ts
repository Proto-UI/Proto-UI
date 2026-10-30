import { definePrototype, tw } from '@proto.ui/core';
import { type ProgressPartExposes, asProgressIndicator } from '@proto.ui/prototypes-base/progress';
import { setupProgressStyle } from './visual';
import type { ShadcnProgressPartProps } from './types';
export default definePrototype<ShadcnProgressPartProps, ProgressPartExposes>({
  name: 'shadcn-progress-indicator',
  modules: asProgressIndicator.modules,
  setup(def) {
    const inherited = asProgressIndicator();
    setupProgressStyle(def);
    def.feedback.style.use(
      tw('block h-full w-[calc(var(--pui-percentage)*1%)] bg-primary transition-all')
    );
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.indeterminate).eq(true),
      intent: (i) => i.feedback.style.use(tw('w-1/3')),
    });
    return inherited.render;
  },
});
