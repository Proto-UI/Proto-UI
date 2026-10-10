import { definePrototype, tw } from '@proto.ui/core';
import {
  asPopoverContent,
  type PopoverContentProps,
  type PopoverContentExposes,
} from '@proto.ui/prototypes-base/popover';

export default definePrototype<PopoverContentProps, PopoverContentExposes>({
  name: 'liquid-glass-popover-content',
  setup(def) {
    const behavior = asPopoverContent();
    def.feedback.style.use(
      tw(
        'rounded-2xl border border-border bg-secondary text-secondary-foreground shadow-md p-5 z-50 w-80 max-w-[var(--proto-ui-available-width)] max-h-[var(--proto-ui-available-height)] overflow-y-auto grid gap-3'
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
