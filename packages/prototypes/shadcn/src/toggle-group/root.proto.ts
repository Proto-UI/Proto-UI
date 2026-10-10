import { definePrototype, tw } from '@proto.ui/core';
import {
  asToggleGroupRoot,
  type ToggleGroupRootProps,
  type ToggleGroupRootExposes,
} from '@proto.ui/prototypes-base/toggle-group';

export default definePrototype<ToggleGroupRootProps, ToggleGroupRootExposes>({
  name: 'shadcn-toggle-group-root',
  setup(def) {
    const behavior = asToggleGroupRoot();
    def.feedback.style.use(
      tw(
        'rounded-md border border-border bg-background text-foreground shadow-sm p-2 flex min-w-0 gap-1'
      )
    );
    def.rule({
      when: (w) => w.state(behavior.stateHandles!.orientation).eq('vertical'),
      intent: (i) => i.feedback.style.use(tw('flex-col')),
    });
  },
});
