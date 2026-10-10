import { definePrototype, tw } from '@proto.ui/core';
import {
  asPopoverContent,
  type PopoverContentProps,
  type PopoverContentExposes,
} from '@proto.ui/prototypes-base/popover';

export default definePrototype<PopoverContentProps, PopoverContentExposes>({
  name: 'shadcn-popover-content',
  setup(def) {
    const behavior = asPopoverContent();
    def.feedback.style.use(
      tw(
        'rounded-lg border border-border bg-popover text-popover-foreground shadow-md p-4 z-50 w-80 max-w-[var(--proto-ui-available-width)] max-h-[var(--proto-ui-available-height)] overflow-y-auto grid gap-3'
      )
    );
    behavior.asTransition.configure({ enterDuration: 0, leaveDuration: 0 });
  },
});
