import { definePrototype, tw } from '@proto.ui/core';
import {
  asToolbarRoot,
  type ToolbarRootProps,
  type ToolbarRootExposes,
} from '@proto.ui/prototypes-base/toolbar';

export default definePrototype<ToolbarRootProps, ToolbarRootExposes>({
  name: 'liquid-glass-toolbar-root',
  setup(def) {
    const behavior = asToolbarRoot();
    def.feedback.style.use(
      tw(
        'rounded-2xl border border-border bg-secondary text-secondary-foreground shadow-md p-2 flex min-w-0 gap-1'
      )
    );
    def.rule({
      when: (w) => w.state(behavior.getState!('orientation')!).eq('vertical'),
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
