import { definePrototype, tw } from '@proto.ui/core';
import {
  asToggleGroupRoot,
  type ToggleGroupRootProps,
  type ToggleGroupRootExposes,
} from '@proto.ui/prototypes-base/toggle-group';

export default definePrototype<ToggleGroupRootProps, ToggleGroupRootExposes>({
  name: 'liquid-glass-toggle-group-root',
  setup(def) {
    const behavior = asToggleGroupRoot();
    def.feedback.style.use(
      tw(
        'rounded-2xl border border-border bg-secondary text-secondary-foreground shadow-md p-2 flex min-w-0 gap-1'
      )
    );
    def.rule({
      when: (w) => w.state(behavior.stateHandles!.orientation).eq('vertical'),
      intent: (i) => i.feedback.style.use(tw('flex-col')),
    });
    def.feedback.material.declare({
      version: 2,
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    });
    def.feedback.material.use({ intent: 'liquid-glass' });
  },
});
