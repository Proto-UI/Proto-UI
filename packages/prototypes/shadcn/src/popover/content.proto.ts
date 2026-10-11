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
        'rounded-lg ring-1 ring-foreground/10 bg-popover text-sm text-popover-foreground shadow-md p-2.5 z-50 w-72 max-w-[var(--proto-ui-available-width)] max-h-[var(--proto-ui-available-height)] overflow-y-auto flex flex-col gap-2.5'
      )
    );
    behavior.asTransition.configure({ enterDuration: 0, leaveDuration: 0 });
  },
});
