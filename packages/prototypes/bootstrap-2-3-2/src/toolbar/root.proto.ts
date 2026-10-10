import { definePrototype, tw } from '@proto.ui/core';
import {
  asToolbarRoot,
  type ToolbarRootProps,
  type ToolbarRootExposes,
} from '@proto.ui/prototypes-base/toolbar';

export default definePrototype<ToolbarRootProps, ToolbarRootExposes>({
  name: 'bootstrap-2-3-2-toolbar-root',
  setup(def) {
    const behavior = asToolbarRoot();
    def.feedback.style.use(
      tw(
        'rounded border border-border bg-background text-foreground shadow-md p-2 flex min-w-0 gap-1'
      )
    );
    def.rule({
      when: (w) => w.state(behavior.getState!('orientation')!).eq('vertical'),
      intent: (i) => i.feedback.style.use(tw('flex-col')),
    });
  },
});
