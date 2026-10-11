import { definePrototype, tw } from '@proto.ui/core';
import {
  asContextMenuContent,
  type ContextMenuContentProps,
  type ContextMenuContentExposes,
} from '@proto.ui/prototypes-base/context-menu';
export default definePrototype<ContextMenuContentProps, ContextMenuContentExposes>({
  name: 'liquid-glass-context-menu-content',
  setup(def) {
    const behavior = asContextMenuContent();
    def.feedback.style.use(
      tw(
        'rounded-2xl border border-border bg-secondary text-secondary-foreground shadow-md z-50 min-w-40 max-w-[var(--proto-ui-available-width)] max-h-[var(--proto-ui-available-height)] overflow-y-auto p-1'
      )
    );
    def.feedback.material.declare({
      version: 2,
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    });
    def.rule({
      when: (w) => w.state(behavior.stateHandles.open).eq(true),
      intent: (i) => i.feedback.material.use({ intent: 'liquid-glass' }),
    });
  },
});
