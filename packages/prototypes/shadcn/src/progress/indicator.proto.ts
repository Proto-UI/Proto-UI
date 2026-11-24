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
    def.feedback.style.use(tw('block h-full bg-primary'));
    def.feedback.style.transition({
      properties: ['width'],
      durationMs: 300,
      easing: [0.4, 0, 0.2, 1],
    });
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.indeterminate).eq(false),
      intent: (i) => i.feedback.style.use(tw('w-[calc(var(--pui-percentage)*1%)]')),
    });
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.indeterminate).eq(true),
      intent: (i) => i.feedback.style.use(tw('w-1/3 ms-auto me-auto rounded-[inherit] opacity-80')),
    });
    return inherited.render;
  },
});
