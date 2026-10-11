import { definePrototype, tw } from '@proto.ui/core';
import {
  asDropdownContent,
  type DropdownContentProps,
  type DropdownContentExposes,
} from '@proto.ui/prototypes-base/dropdown';
export default definePrototype<DropdownContentProps, DropdownContentExposes>({
  name: 'liquid-glass-dropdown-content',
  setup(def) {
    const behavior = asDropdownContent();
    behavior.asTransition.configure({ enterDuration: 0, leaveDuration: 0 });
    def.feedback.style.use(
      tw(
        'z-50 min-w-32 max-w-[var(--proto-ui-available-width)] max-h-[var(--proto-ui-available-height)] overflow-x-hidden overflow-y-auto outline-none rounded-2xl border border-border bg-secondary text-secondary-foreground p-2 shadow-md'
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
