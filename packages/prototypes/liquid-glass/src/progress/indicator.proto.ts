import { definePrototype, tw } from '@proto.ui/core';
import {
  type ProgressPartProps,
  type ProgressPartExposes,
  asProgressIndicator,
} from '@proto.ui/prototypes-base/progress';
export default definePrototype<ProgressPartProps, ProgressPartExposes>({
  name: 'liquid-glass-progress-indicator',
  setup(def) {
    const inherited = asProgressIndicator();
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
