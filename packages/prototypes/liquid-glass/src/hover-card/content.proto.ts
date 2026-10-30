import { definePrototype, tw } from '@proto.ui/core';
import {
  asHoverCardContent,
  type HoverCardContentProps,
  type HoverCardContentExposes,
} from '@proto.ui/prototypes-base/hover-card';

export default definePrototype<HoverCardContentProps, HoverCardContentExposes>({
  name: 'liquid-glass-hover-card-content',
  setup(def) {
    const behavior = asHoverCardContent();
    def.feedback.style.use(
      tw(
        'rounded-2xl border border-border bg-secondary text-secondary-foreground shadow-md p-4 z-50 w-80 max-w-[var(--proto-ui-available-width)] max-h-[var(--proto-ui-available-height)] overflow-y-auto grid gap-3'
      )
    );
    behavior.asTransition.configure({ enterDuration: 0, leaveDuration: 0 });
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
