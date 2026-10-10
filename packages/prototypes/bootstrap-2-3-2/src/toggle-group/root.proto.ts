import { definePrototype, tw } from '@proto.ui/core';
import {
  asToggleGroupRoot,
  type ToggleGroupRootProps,
  type ToggleGroupRootExposes,
} from '@proto.ui/prototypes-base/toggle-group';

export default definePrototype<ToggleGroupRootProps, ToggleGroupRootExposes>({
  name: 'bootstrap-2-3-2-toggle-group-root',
  setup(def) {
    const behavior = asToggleGroupRoot();
    def.feedback.style.use(
      tw(
        'rounded border border-border bg-background text-foreground shadow-md p-2 flex min-w-0 gap-1'
      )
    );
  },
});
