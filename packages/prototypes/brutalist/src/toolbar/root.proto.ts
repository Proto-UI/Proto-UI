import { definePrototype, tw } from '@proto.ui/core';
import {
  asToolbarRoot,
  type ToolbarRootProps,
  type ToolbarRootExposes,
} from '@proto.ui/prototypes-base/toolbar';

export default definePrototype<ToolbarRootProps, ToolbarRootExposes>({
  name: 'brutalist-toolbar-root',
  setup(def) {
    const behavior = asToolbarRoot();
    def.feedback.style.use(
      tw(
        'rounded-none border-2 border-foreground bg-background text-foreground shadow-[3px_3px_0_0_var(--pui-foreground)] p-2 flex min-w-0 gap-1'
      )
    );
    def.rule({
      when: (w) => w.state(behavior.getState!('orientation')!).eq('vertical'),
      intent: (i) => i.feedback.style.use(tw('flex-col')),
    });
  },
});
