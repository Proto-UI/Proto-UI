import { definePrototype, tw } from '@proto.ui/core';
import {
  asPopoverContent,
  type PopoverContentProps,
  type PopoverContentExposes,
} from '@proto.ui/prototypes-base/popover';

export default definePrototype<PopoverContentProps, PopoverContentExposes>({
  name: 'brutalist-popover-content',
  setup(def) {
    const behavior = asPopoverContent();
    def.feedback.style.use(
      tw(
        'rounded-base border-2 border-border bg-background text-foreground font-sans font-medium p-4 z-50 w-72 max-w-[var(--proto-ui-available-width)] max-h-[var(--proto-ui-available-height)] overflow-y-auto flex flex-col gap-4'
      )
    );
    behavior.asTransition.configure({ enterDuration: 0, leaveDuration: 0 });
  },
});
