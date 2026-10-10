import { definePrototype, tw } from '@proto.ui/core';
import {
  asToggleGroupRoot,
  type ToggleGroupRootProps,
  type ToggleGroupRootExposes,
} from '@proto.ui/prototypes-base/toggle-group';

export default definePrototype<ToggleGroupRootProps, ToggleGroupRootExposes>({
  name: 'brutalist-toggle-group-root',
  setup(def) {
    const behavior = asToggleGroupRoot();
    def.feedback.style.use(
      tw(
        'rounded-none border-2 border-foreground bg-background text-foreground shadow-[3px_3px_0_0_var(--pui-foreground)] p-2 flex min-w-0 gap-1'
      )
    );
  },
});
